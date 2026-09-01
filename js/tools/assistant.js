/* ============================================================
   TOOLBOX — Assistant View & Interactive AI Workflow Host
   Interactive Chat Interface with In-Chat Drag & Dropzone Cards,
   Global File Drag-over, and Multi-Tool Client-Side Execution.
   ============================================================ */

import { marked } from 'marked';
import { openSettings } from '../lib/settings-ui.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdown(text) {
  if (!text) return '';
  try {
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      return marked.parse(text);
    }
  } catch {}
  return escapeHtml(text).replace(/\n/g, '<br/>');
}
import {
  streamChatCompletion,
  getActiveAiMode,
  AI_MODES
} from '../lib/ai-provider.js';
import { QuotaManager } from '../lib/quota-manager.js';
import { getCurrentUser } from '../lib/supabase.js';
import { openAccountModal } from '../views/account-modal.js';
import { AssistantAudioManager } from '../lib/assistant-audio.js';
import { ConversationIntegrationManager } from '../lib/assistant-integration.js';
import TOOLS from '../registry/tools.js';
const BY_ID = new Map(TOOLS.map(t => [t.id, t]));

const STORAGE_HISTORY = 'toolbox_assistant_history_v2';
const STORAGE_KEEP_CONTEXT = 'toolbox_assistant_keep_context';

export default {
  render(container, state = {}) {
    const currentToolId = state.tool?.id || null;
    let keepContext = localStorage.getItem(STORAGE_KEEP_CONTEXT) !== 'false';
    let currentAssistantAbortCtrl = null;
    let hasStartedConversation = false;

    // Initialize Phase 2 Integration Manager
    const integrationManager = new ConversationIntegrationManager({
      history: [],
      keepContext,
      audioManager: AssistantAudioManager,
      onHistoryChange: () => {
        // Optional: custom behavior on history updates
      },
      onMessageRendered: () => {
        // Optional: custom behavior after rendering
      }
    });

    let history = [];

    const taskState = {
      activeToolId: currentToolId || null,
      lastProcessedImage: null,
      lastCsvText: null,
      attachedFiles: []
    };

    const quota = QuotaManager.getQuotaSummary();
    const user = getCurrentUser();
    let currentMode = getActiveAiMode();

    function getModeBadgeHtml() {
      return '';
    }

    container.innerHTML = `
      <div class="toolbox-assistant-root" style="max-width:1040px; margin:0 auto; display:flex; flex-direction:column; height:calc(100vh - 200px); min-height:540px; max-height:840px; background:var(--white); border:1px solid var(--g200); border-radius:18px; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,0.08); position:relative; font-family:var(--sans);">
        
        <!-- HEADER BAR -->
        <div style="padding:12px 20px; border-bottom:1px solid var(--g200); background:var(--g50); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; flex-shrink:0;">
          
          <!-- Left: Logo, Active Context -->
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <div>
                <span style="font-size:0.96rem; font-weight:800; color:var(--black); letter-spacing:-0.01em;">Assistant</span>
              </div>
            </div>

            <div style="height:22px; width:1px; background:var(--g300);"></div>

            <!-- Keep Context Toggle -->
            <label style="display:flex; align-items:center; gap:6px; font-size:0.76rem; font-weight:600; cursor:pointer; user-select:none; color:var(--g700);" title="Preserve multi-turn memory across follow-ups">
              <input type="checkbox" id="ast-chk-context" ${keepContext ? 'checked' : ''} style="cursor:pointer; accent-color:var(--black);">
              Keep Context
            </label>
          </div>

          <!-- Right: Account, Clear -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-account" style="font-size:0.74rem;" title="${user ? 'Signed in as ' + user.email : 'Sign in for cloud sync'}">
              ${user ? 'Account' : 'Cloud Sync'}
            </button>

            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-clear" style="font-size:0.74rem; color:#ef4444;" title="Clear Conversation">
              Clear
            </button>
          </div>
        </div>

        <!-- CHAT MESSAGE STREAM -->
        <div id="ast-messages" style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:20px; background:var(--white);">
          <!-- Messages will be rendered here -->
        </div>

        <!-- ATTACHED FILE PREVIEW BAR -->
        <div id="ast-attached-bar" style="display:none; padding:8px 20px; background:var(--g100); border-top:1px solid var(--g200); align-items:center; justify-content:space-between; flex-shrink:0;">
          <div style="display:flex; align-items:center; gap:8px; font-size:0.78rem; font-weight:600; color:var(--g800);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span id="ast-attached-name">image.png</span>
            <span id="ast-attached-size" style="color:var(--g500); font-weight:400;">(240 KB)</span>
          </div>
          <button type="button" id="ast-attached-remove" style="background:none; border:none; color:var(--g500); cursor:pointer; font-size:1.1rem; line-height:1;">&times;</button>
        </div>

        <!-- QUICK PROMPT CHIPS -->
        <div style="padding:6px 20px; background:var(--g50); border-top:1px solid var(--g200); display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; flex-shrink:0;" id="ast-chips">
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Convert this image to WebP and resize to 1200px</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Calculate $10,000 compound interest at 7% for 10 years</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Balance chemical equation: H2 + O2 = H2O</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Analyze and chart this CSV dataset</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Run Python script to find prime numbers</button>
        </div>

        <!-- BOTTOM INPUT FORM -->
        <div style="padding:14px 20px; background:var(--white); border-top:1px solid var(--g200); display:flex; align-items:flex-end; gap:12px; flex-shrink:0;">
          
          <input type="file" id="ast-file-input" style="display:none;" />

          <button type="button" class="btn btn-secondary" id="ast-attach-btn" style="height:44px; width:44px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;" title="Attach image, CSV, PDF, or file">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <div style="flex:1; display:flex; align-items:flex-end;">
            <div style="flex:1; position:relative; display:flex;">
              <textarea
                id="ast-user-input"
                class="tool-input"
                placeholder="Ask anything, drag & drop a file, request code, or trigger tools..."
                rows="1"
                style="display:block; margin:0; width:100%; min-height:44px; max-height:140px; padding:11px 16px; resize:none; border-radius:24px 0 0 24px; font-size:0.92rem; line-height:1.45; font-family:inherit; border:1px solid var(--g300); border-right:none; background:var(--white); box-sizing:border-box; scrollbar-width:none; outline:none;"
              ></textarea>
            </div>

            <button type="button" class="btn btn-primary" id="ast-send-btn" style="height:44px; padding:0 22px; border-radius:0 24px 24px 0; font-weight:700; display:flex; align-items:center; gap:6px; flex-shrink:0; border:1px solid var(--black); border-left:none; box-sizing:border-box; margin:0;">
              <span>Send</span>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>

      </div>
    `;

    // DOM Elements
    const rootEl = container.querySelector('.toolbox-assistant-root');
    const messagesEl = container.querySelector('#ast-messages');
    const userInput = container.querySelector('#ast-user-input');
    const sendBtn = container.querySelector('#ast-send-btn');
    const fileInput = container.querySelector('#ast-file-input');
    const attachBtn = container.querySelector('#ast-attach-btn');

    const updatePromptPlaceholder = () => {
      if (userInput) {
        userInput.placeholder = window.matchMedia?.('(max-width: 600px)')?.matches
          ? 'Ask Assistant…'
          : 'Ask anything, drag & drop a file, request code, or trigger tools...';
      }
    };
    updatePromptPlaceholder();
    const attachedBar = container.querySelector('#ast-attached-bar');
    const attachedName = container.querySelector('#ast-attached-name');
    const attachedSize = container.querySelector('#ast-attached-size');
    const attachedRemove = container.querySelector('#ast-attached-remove');
    const btnAiModes = container.querySelector('#ast-btn-ai-modes');
    const btnAccount = container.querySelector('#ast-btn-account');
    const btnQuota = container.querySelector('#ast-btn-quota');
    const quotaLabel = container.querySelector('#ast-quota-label');
    const btnClear = container.querySelector('#ast-btn-clear');
    const chkContext = container.querySelector('#ast-chk-context');
    const chipsWrap = container.querySelector('#ast-chips');
    const badgeWrap = container.querySelector('#ast-mode-badge-wrap');

    let currentAttachedFile = null;

    function refreshModeDisplay() {
      currentMode = getActiveAiMode();
      if (badgeWrap) {
        badgeWrap.innerHTML = getModeBadgeHtml();
        badgeWrap.querySelector('#ast-btn-mode-badge')?.addEventListener('click', openSettings);
      }
    }

    function updateQuotaDisplay() {
      const q = QuotaManager.getQuotaSummary();
      if (quotaLabel) {
        if (q.isUnlimited) {
          quotaLabel.innerHTML = `<strong style="color:#16a34a;">Unlimited VIP</strong>`;
        } else {
          quotaLabel.textContent = `${q.messagesRemaining} / ${q.messagesLimit} msgs`;
        }
      }
    }

    // Event listeners
    btnAccount?.addEventListener('click', openAccountModal);

    const onModeChange = () => {
      refreshModeDisplay();
    };
    window.addEventListener('toolbox:aimodechange', onModeChange);
    window.addEventListener('toolbox:quotachange', updateQuotaDisplay);

    // Clear conversation
    btnClear?.addEventListener('click', async () => {
      if (confirm('Clear current conversation history?')) {
        history = [];
        await integrationManager.clearConversation();
        renderMessageList();
      }
    });

    // Toggle keep context
    chkContext?.addEventListener('change', (e) => {
      keepContext = e.target.checked;
      localStorage.setItem(STORAGE_KEEP_CONTEXT, keepContext ? 'true' : 'false');
      if (!keepContext) localStorage.removeItem(STORAGE_HISTORY);
    });

    // Attachments
    attachBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleFileSelected(file);
    });

    attachedRemove?.addEventListener('click', () => {
      currentAttachedFile = null;
      if (attachedBar) attachedBar.style.display = 'none';
      if (fileInput) fileInput.value = '';
    });

    // Global Drag & Drop over Assistant View
    ['dragenter', 'dragover'].forEach(evtName => {
      rootEl?.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        rootEl.classList.add('is-drag-over');
      });
    });

    ['dragleave', 'dragend'].forEach(evtName => {
      rootEl?.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target === rootEl) rootEl.classList.remove('is-drag-over');
      });
    });

    rootEl?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rootEl.classList.remove('is-drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleFileSelected(file);
      }
    });

    function handleFileSelected(file, autoPrompt = false) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const raw = evt.target.result;
        const base64 = typeof raw === 'string' && raw.includes(',') ? raw.split(',')[1] : null;
        currentAttachedFile = {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: raw,
          base64: base64,
          text: typeof raw === 'string' && !raw.startsWith('data:') ? raw : null
        };
        if (attachedName) attachedName.textContent = file.name;
        if (attachedSize) attachedSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
        if (attachedBar) attachedBar.style.display = 'flex';

        if (autoPrompt && userInput && !userInput.value.trim()) {
          if (file.type.includes('pdf')) {
            userInput.value = `Process this PDF document: ${file.name}`;
          } else if (file.type.startsWith('image/')) {
            userInput.value = `Analyze and format this image: ${file.name}`;
          } else if (file.type.includes('csv') || file.name.endsWith('.csv')) {
            userInput.value = `Analyze and chart this dataset: ${file.name}`;
          } else {
            userInput.value = `Process attached file: ${file.name}`;
          }
          handleAutoResize();
          handleSend();
        } else {
          userInput?.focus();
        }
      };

      if (file.type.startsWith('image/') || file.type.includes('pdf') || file.type.startsWith('audio/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }

    // Chips
    chipsWrap?.addEventListener('click', (e) => {
      const chip = e.target.closest('.ast-chip');
      if (chip && userInput) {
        userInput.value = chip.textContent.trim();
        userInput.focus();
        handleAutoResize();
      }
    });

    function handleAutoResize() {
      if (!userInput) return;
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
    }
    userInput?.addEventListener('input', handleAutoResize);

    userInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    sendBtn?.addEventListener('click', handleSend);

    function renderMessageList() {
      if (!messagesEl) return;
      messagesEl.innerHTML = '';
      
      if (chipsWrap) {
        if (history.length > 0) {
          chipsWrap.style.display = 'none';
        } else {
          chipsWrap.style.display = 'flex';
        }
      }

      if (!history.length) {
        messagesEl.innerHTML = `
          <div style="text-align:center; padding:48px 20px; color:var(--g500);">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--g100); color:var(--black); margin:0 auto 14px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <h4 style="margin:0 0 6px; font-size:1.05rem; font-weight:700; color:var(--black);">How can Assistant help you?</h4>
            <p style="margin:0; font-size:0.84rem; max-width:460px; margin:0 auto; line-height:1.5;">
              I can answer questions, solve math and science equations, convert and resize images, analyze CSV datasets, execute sandboxed code, and trigger 100+ Toolbox tools.
            </p>
          </div>
        `;
        return;
      }

      for (const msg of history) {
        if (msg.role === 'user') {
          appendRenderedMessage('user', msg.content, [], msg.filePreview, msg.turnId);
        } else if (msg.role === 'assistant') {
          appendRenderedMessage('assistant', msg.content, msg.toolResults || [], null, msg.turnId, msg.error, msg.status);
        }
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendRenderedMessage(role, text, toolResults = [], filePreview = null, turnId = null, error = null, status = null) {
      if (!messagesEl) return;
      const msgDiv = document.createElement('div');
      msgDiv.className = `ast-msg ast-msg-${role}`;
      if (turnId) {
        try { if (!msgDiv.dataset) msgDiv.dataset = {}; msgDiv.dataset.turnId = turnId; } catch {}
        msgDiv.setAttribute?.('data-turn-id', turnId);
      }
      msgDiv.style.display = 'flex';
      msgDiv.style.gap = '12px';
      msgDiv.style.maxWidth = role === 'user' ? '80%' : '90%';
      msgDiv.style.alignSelf = role === 'user' ? 'flex-end' : 'flex-start';

      if (role === 'user') {
        msgDiv.innerHTML = `
          <div style="background:var(--black); color:var(--white); padding:12px 18px; border-radius:16px; font-size:0.9rem; line-height:1.5; word-break:break-word;">
            ${filePreview ? `
              <div style="font-size:0.75rem; opacity:0.8; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
                <span>📎</span> <span>${escapeHtml(filePreview.name)}</span>
              </div>
            ` : ''}
            <div>${escapeHtml(text)}</div>
          </div>
        `;
      } else {
        const isFailed = status === 'failed' || (error && !text && !toolResults?.length);
        const lower = (text || '').toLowerCase();
        const needsFilePrompt = !isFailed && (
          lower.includes('upload') ||
          lower.includes('drag & drop') ||
          lower.includes('attach your') ||
          lower.includes('attach the') ||
          lower.includes('attach a') ||
          toolResults.some(r => r?.status === 'needs_file')
        );

        let bodyHtml = '';
        if (isFailed) {
          bodyHtml = `
            <div class="ast-tool-status-area" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;"></div>
            <div class="ast-text-body">
              <div style="color:#ef4444; font-weight:600; margin-bottom:8px; line-height:1.4;">${escapeHtml(error || 'Assistant failed to respond.')}</div>
              <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                <button type="button" class="btn btn-secondary btn-sm ast-err-btn-retry" style="font-size:0.75rem; font-weight:700;">
                  Retry Request
                </button>
              </div>
            </div>
            <div class="ast-tool-results-area"></div>
          `;
        } else {
          bodyHtml = `
            <div class="ast-tool-status-area" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;"></div>
            <div class="ast-text-body">${formatMarkdown(text || '')}</div>
            ${needsFilePrompt ? `
              <div class="ast-inchat-dropzone-card">
                <div class="ast-inchat-drop-inner">
                  <div class="ast-inchat-drop-icon-wrap">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:0.86rem; font-weight:700; color:var(--black);">Drag & drop file here</div>
                    <div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">
                      or <span class="ast-inchat-browse-btn" style="color:var(--black); font-weight:700; text-decoration:underline; cursor:pointer;">Browse device</span> (PDF, Image, CSV, Audio)
                    </div>
                  </div>
                </div>
                <input type="file" class="ast-inchat-file-input" style="display:none;" />
              </div>
            ` : ''}
            <div class="ast-tool-results-area" style="margin-top:12px; display:flex; flex-direction:column; gap:8px;"></div>
          `;
        }

        msgDiv.innerHTML = `
          <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <div style="background:var(--g100); color:var(--black); padding:14px 18px; border-radius:16px; font-size:0.9rem; line-height:1.6; word-break:break-word; min-width:120px;">
            ${bodyHtml}
          </div>
        `;

        if (isFailed && turnId) {
          msgDiv.querySelector('.ast-err-btn-retry')?.addEventListener('click', () => {
            retryTurn(turnId, msgDiv);
          });
        }

        // Wire in-chat dropzone
        const dropCard = msgDiv.querySelector('.ast-inchat-dropzone-card');
        const inFileInput = msgDiv.querySelector('.ast-inchat-file-input');
        if (dropCard && inFileInput) {
          dropCard.addEventListener('click', () => inFileInput.click());
          inFileInput.addEventListener('change', (e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f, true);
          });
          dropCard.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropCard.classList.add('dragover');
          });
          dropCard.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropCard.classList.remove('dragover');
          });
          dropCard.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropCard.classList.remove('dragover');
            const f = e.dataTransfer?.files?.[0];
            if (f) handleFileSelected(f, true);
          });
        }
      }

      messagesEl.appendChild(msgDiv);
      const resultsArea = msgDiv.querySelector('.ast-tool-results-area');
      if (role === 'assistant' && resultsArea) {
        for (const result of toolResults) {
          void integrationManager.renderToolResult(result, resultsArea);
        }
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderToolResultCard(result) {
      if (!result) return '';

      // Interactive Audio Player Card
      if (result.type === 'audio' || result.audioId) {
        if (['pause', 'resume', 'stop', 'volume', 'seek'].includes(result.action)) {
          return '';
        }
        const audioId = result.audioId;
        const dur = Math.max(1, Math.round(result.duration || 30));
        const formatTime = (s) => {
          const m = Math.floor(s / 60);
          const rem = Math.floor(s % 60);
          return `${m}:${rem < 10 ? '0' : ''}${rem}`;
        };

        return `
          <div class="ast-audio-player-card" data-audio-id="${audioId}" style="padding:14px 16px; background:var(--white); border:1px solid var(--g300); border-radius:14px; box-shadow:0 4px 14px rgba(0,0,0,0.05); margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
              <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                ${result.artworkUrl ? `
                  <img src="${result.artworkUrl}" style="width:38px; height:38px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                ` : `
                  <div style="width:38px; height:38px; border-radius:8px; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  </div>
                `}
                <div style="overflow:hidden;">
                  <div style="font-weight:700; font-size:0.88rem; color:var(--black); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${escapeHtml(result.title || 'Audio Sample')}
                  </div>
                  <div style="font-size:0.74rem; color:var(--g600); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${escapeHtml(result.artist || 'Toolbox Audio')}
                  </div>
                </div>
              </div>

              <!-- Stop Button -->
              <button type="button" class="btn btn-secondary btn-sm ast-audio-btn-stop" data-audio-id="${audioId}" style="font-size:0.72rem; padding:4px 8px; color:#ef4444; flex-shrink:0;">
                Stop
              </button>
            </div>

            <!-- Scrubber bar & Play button -->
            <div style="display:flex; align-items:center; gap:10px;">
              <button type="button" class="ast-audio-btn-toggle" data-audio-id="${audioId}" style="width:36px; height:36px; border-radius:50%; background:var(--black); color:var(--white); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:transform 0.1s;" title="Play / Pause">
                <svg class="ast-audio-icon-play" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:none;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <svg class="ast-audio-icon-pause" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>

              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <input type="range" class="ast-audio-seek" data-audio-id="${audioId}" min="0" max="${dur}" step="0.1" value="0" style="width:100%; cursor:pointer; accent-color:var(--black);">
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-family:var(--mono); color:var(--g600);">
                  <span class="ast-audio-time-cur">0:00</span>
                  <span class="ast-audio-time-dur">${formatTime(dur)}</span>
                </div>
              </div>

              <!-- Volume Control -->
              <div style="display:flex; align-items:center; gap:4px; margin-left:4px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--g500);"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                <input type="range" class="ast-audio-volume" data-audio-id="${audioId}" min="0" max="1" step="0.05" value="1" style="width:45px; cursor:pointer; accent-color:var(--black);" title="Volume">
              </div>
            </div>
          </div>
        `;
      }

      // Speed Test Card
      if (typeof result.downloadSpeedMbps !== 'undefined') {
        return `
          <div style="padding:14px 16px; background:var(--white); border:1px solid var(--g300); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:0.84rem; font-weight:800; color:var(--black); display:flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Network Speed Test
              </span>
              <span style="font-size:0.72rem; color:var(--g600); font-weight:600;">${escapeHtml(result.city || 'Online')}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:10px;">
              <div style="background:var(--g50); padding:8px 10px; border-radius:8px; border:1px solid var(--g200); text-align:center;">
                <div style="font-size:0.68rem; color:var(--g500); text-transform:uppercase; font-weight:700;">Download</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--black); font-family:monospace;">${result.downloadSpeedMbps} <span style="font-size:0.65rem;">Mbps</span></div>
              </div>
              <div style="background:var(--g50); padding:8px 10px; border-radius:8px; border:1px solid var(--g200); text-align:center;">
                <div style="font-size:0.68rem; color:var(--g500); text-transform:uppercase; font-weight:700;">Latency</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--black); font-family:monospace;">${result.latencyMs} <span style="font-size:0.65rem;">ms</span></div>
              </div>
              <div style="background:var(--g50); padding:8px 10px; border-radius:8px; border:1px solid var(--g200); text-align:center;">
                <div style="font-size:0.68rem; color:var(--g500); text-transform:uppercase; font-weight:700;">Jitter</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--black); font-family:monospace;">${result.jitterMs} <span style="font-size:0.65rem;">ms</span></div>
              </div>
            </div>
            <div style="font-size:0.75rem; color:var(--g600); display:flex; justify-content:space-between;">
              <span>ISP: <strong>${escapeHtml(result.isp || 'Broadband')}</strong></span>
              <span>IP: <strong>${escapeHtml(result.ip || 'Detected')}</strong></span>
            </div>
          </div>
        `;
      }

      // DNS Lookup Card
      if (result.answers && Array.isArray(result.answers)) {
        return `
          <div style="padding:12px 14px; background:var(--white); border:1px solid var(--g300); border-radius:12px;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--black); margin-bottom:8px;">DNS ${result.type || 'A'} Records (${escapeHtml(result.domain || '')})</div>
            <div style="display:flex; flex-direction:column; gap:4px; font-family:monospace; font-size:0.76rem;">
              ${result.answers.length ? result.answers.map(a => `
                <div style="padding:4px 8px; background:var(--g50); border-radius:6px; border:1px solid var(--g200); display:flex; justify-content:space-between;">
                  <span>${escapeHtml(a.data)}</span>
                  <span style="color:var(--g500);">TTL: ${a.TTL}s</span>
                </div>
              `).join('') : '<div style="color:var(--g500);">No DNS records returned.</div>'}
            </div>
          </div>
        `;
      }

      // Weather Card
      if (typeof result.temperature !== 'undefined' && result.city) {
        return `
          <div style="padding:12px 14px; background:var(--white); border:1px solid var(--g300); border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.86rem; font-weight:800; color:var(--black);">${escapeHtml(result.city)}, ${escapeHtml(result.country || '')}</div>
              <div style="font-size:0.74rem; color:var(--g600); margin-top:2px;">Wind: ${result.windspeed} km/h</div>
            </div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--black); font-family:monospace;">
              ${result.temperature}°C
            </div>
          </div>
        `;
      }

      // Note Created Card
      if (result.noteId) {
        return `
          <div style="padding:14px 16px; background:var(--white); border:1px solid var(--g300); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:0.86rem; font-weight:800; color:var(--black); display:flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Note Created: ${escapeHtml(result.title)}
              </span>
              <span style="font-size:0.7rem; background:var(--g100); padding:2px 8px; border-radius:999px; font-weight:600; text-transform:capitalize;">${escapeHtml(result.folder || 'quick')}</span>
            </div>
            <div style="background:var(--g50); padding:10px 12px; border-radius:8px; border:1px solid var(--g200); font-size:0.8rem; font-family:monospace; line-height:1.45; max-height:140px; overflow-y:auto; margin-bottom:10px; color:var(--g800); white-space:pre-wrap;">${escapeHtml(result.body || '')}</div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <a href="#notes" class="btn btn-primary btn-sm" style="font-size:0.74rem; font-weight:700; padding:4px 12px;">
                Open in Notes &rarr;
              </a>
            </div>
          </div>
        `;
      }

      // Artifact Saved Card
      if (result.artifact) {
        return `
          <div style="padding:12px 14px; background:var(--white); border:1px solid var(--g300); border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.84rem; font-weight:800; color:var(--black);">Saved Artifact: ${escapeHtml(result.artifact.name)}</div>
              <div style="font-size:0.72rem; color:var(--g600); margin-top:2px;">Added to your Saved Items library</div>
            </div>
            <a href="#saved" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:4px 10px;">
              View Saved &rarr;
            </a>
          </div>
        `;
      }

      // Image / PDF / QR Code Artifact Card
      if (result.dataUrl) {
        const isPdf = result.dataUrl.startsWith('data:application/pdf') || (result.filename || '').endsWith('.pdf');
        return `
          <div style="padding:12px; background:var(--white); border:1px solid var(--g300); border-radius:12px;">
            <div style="font-size:0.78rem; font-weight:700; color:var(--black); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>Generated Artifact</span>
              <a href="${result.dataUrl}" download="${result.filename || 'processed-file'}" class="btn btn-primary btn-sm" style="font-size:0.72rem; padding:4px 10px;">
                Download ${result.filename || 'File'}
              </a>
            </div>
            ${isPdf ? `
              <div style="padding:14px; background:var(--g50); border:1px solid var(--g200); border-radius:8px; text-align:center; font-size:0.82rem; font-weight:600; color:var(--g800);">
                📄 PDF Document (${result.pageCount || 1} page${(result.pageCount || 1) > 1 ? 's' : ''})
              </div>
            ` : `
              <img src="${result.dataUrl}" style="max-width:100%; max-height:220px; border-radius:8px; display:block; object-fit:contain; background:#111;">
            `}
          </div>
        `;
      }

      if (result.tools && Array.isArray(result.tools)) {
        return `
          <div style="padding:12px; background:var(--white); border:1px solid var(--g300); border-radius:12px;">
            <div style="font-size:0.76rem; font-weight:700; color:var(--black); margin-bottom:8px;">Matching Toolbox Tools</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${result.tools.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--g50); border-radius:8px; border:1px solid var(--g200);">
                  <div>
                    <div style="font-size:0.82rem; font-weight:700; color:var(--black);">${escapeHtml(t.name)}</div>
                    <div style="font-size:0.72rem; color:var(--g600);">${escapeHtml(t.description || t.desc || '')}</div>
                  </div>
                  <a href="#${t.id}" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:3px 8px; white-space:nowrap;">
                    Open &rarr;
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      return '';
    }

    function bindAudioControls(parentEl = document) {
      if (!parentEl) return;
      const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const rem = Math.floor(s % 60);
        return `${m}:${rem < 10 ? '0' : ''}${rem}`;
      };

      const cards = parentEl.querySelectorAll('.ast-audio-player-card');
      cards.forEach(card => {
        if (card.dataset.bound) return;
        card.dataset.bound = 'true';

        const audioId = card.dataset.audioId;
        const btnToggle = card.querySelector('.ast-audio-btn-toggle');
        const iconPlay = card.querySelector('.ast-audio-icon-play');
        const iconPause = card.querySelector('.ast-audio-icon-pause');
        const btnStop = card.querySelector('.ast-audio-btn-stop');
        const seekInput = card.querySelector('.ast-audio-seek');
        const curTimeEl = card.querySelector('.ast-audio-time-cur');
        const durTimeEl = card.querySelector('.ast-audio-time-dur');
        const volInput = card.querySelector('.ast-audio-volume');

        let isUserSeeking = false;

        const updateCardUi = (inst) => {
          if (!inst) return;
          if (iconPlay && iconPause) {
            iconPlay.style.display = inst.isPlaying ? 'none' : 'block';
            iconPause.style.display = inst.isPlaying ? 'block' : 'none';
          }
          if (seekInput && !isUserSeeking) {
            seekInput.max = inst.duration || 30;
            seekInput.value = inst.currentTime || 0;
          }
          if (curTimeEl) {
            curTimeEl.textContent = formatTime(inst.currentTime || 0);
          }
          if (durTimeEl && inst.duration) {
            durTimeEl.textContent = formatTime(inst.duration);
          }
          if (volInput && typeof inst.volume === 'number') {
            volInput.value = inst.volume;
          }
        };

        const currentInst = AssistantAudioManager.getInstance(audioId);
        if (currentInst) {
          updateCardUi(currentInst);
        }

        btnToggle?.addEventListener('click', () => {
          const inst = AssistantAudioManager.getInstance(audioId);
          if (inst) {
            if (inst.isPlaying) {
              AssistantAudioManager.pause(audioId);
            } else {
              AssistantAudioManager.resume(audioId);
            }
          }
        });

        btnStop?.addEventListener('click', () => {
          AssistantAudioManager.stop(audioId);
        });

        seekInput?.addEventListener('mousedown', () => { isUserSeeking = true; });
        seekInput?.addEventListener('touchstart', () => { isUserSeeking = true; });

        seekInput?.addEventListener('input', () => {
          if (curTimeEl) curTimeEl.textContent = formatTime(parseFloat(seekInput.value));
        });

        seekInput?.addEventListener('change', () => {
          isUserSeeking = false;
          AssistantAudioManager.seek(audioId, parseFloat(seekInput.value));
        });

        volInput?.addEventListener('input', () => {
          AssistantAudioManager.setVolume(audioId, parseFloat(volInput.value));
        });
      });
    }

    // Subscribe to global real-time audio service updates
    AssistantAudioManager.subscribe((event, inst) => {
      if (!messagesEl || !inst?.id) return;
      const cards = messagesEl.querySelectorAll(`.ast-audio-player-card[data-audio-id="${inst.id}"]`);
      const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const rem = Math.floor(s % 60);
        return `${m}:${rem < 10 ? '0' : ''}${rem}`;
      };

      cards.forEach(card => {
        const iconPlay = card.querySelector('.ast-audio-icon-play');
        const iconPause = card.querySelector('.ast-audio-icon-pause');
        const seekInput = card.querySelector('.ast-audio-seek');
        const curTimeEl = card.querySelector('.ast-audio-time-cur');
        const durTimeEl = card.querySelector('.ast-audio-time-dur');

        if (iconPlay && iconPause) {
          iconPlay.style.display = inst.isPlaying ? 'none' : 'block';
          iconPause.style.display = inst.isPlaying ? 'block' : 'none';
        }
        if (seekInput && document.activeElement !== seekInput) {
          seekInput.max = inst.duration || 30;
          seekInput.value = inst.currentTime || 0;
        }
        if (curTimeEl) {
          curTimeEl.textContent = formatTime(inst.currentTime || 0);
        }
        if (durTimeEl && inst.duration) {
          durTimeEl.textContent = formatTime(inst.duration);
        }
      });
    });

    function persistHistory() {
      if (keepContext) {
        try {
          // Use the integration manager's single conversation store.
          void integrationManager.persistHistory(history).catch(e => console.warn('[Assistant] Failed to persist chat history:', e));
        } catch (e) {
          console.warn('[Assistant] Failed to persist chat history:', e);
        }
      }
    }

    async function handleSend() {
      if (sendBtn && sendBtn.disabled) return;
      if (currentAssistantAbortCtrl) return;

      const text = userInput?.value?.trim() || '';
      const fileToProcess = currentAttachedFile;

      if (!text && !fileToProcess) return;
      hasStartedConversation = true;

      const quotaCheck = QuotaManager.canSendMessage();
      if (!quotaCheck.allowed) {
        alert(quotaCheck.reason);
        return;
      }

      const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (userInput) userInput.value = '';
      handleAutoResize();

      currentAttachedFile = null;
      if (attachedBar) attachedBar.style.display = 'none';
      if (fileInput) fileInput.value = '';

      // 1. Immediately commit and persist user turn
      const userMsgObj = {
        id: `msg_${Date.now()}_u`,
        turnId,
        role: 'user',
        content: text || `[Attached file: ${fileToProcess.name}]`,
        fileData: fileToProcess ? {
          name: fileToProcess.name,
          type: fileToProcess.type,
          base64: fileToProcess.base64,
          text: fileToProcess.text
        } : null,
        filePreview: fileToProcess ? { name: fileToProcess.name, size: fileToProcess.size } : null,
        timestamp: Date.now()
      };

      history.push(userMsgObj);
      persistHistory();
      appendRenderedMessage('user', userMsgObj.content, [], userMsgObj.filePreview);

      if (sendBtn) sendBtn.disabled = true;

      const assistantMsgDiv = document.createElement('div');
      assistantMsgDiv.className = 'ast-msg ast-msg-assistant';
      if (turnId) {
        try { if (!assistantMsgDiv.dataset) assistantMsgDiv.dataset = {}; assistantMsgDiv.dataset.turnId = turnId; } catch {}
        assistantMsgDiv.setAttribute?.('data-turn-id', turnId);
      }
      assistantMsgDiv.style.display = 'flex';
      assistantMsgDiv.style.gap = '12px';
      assistantMsgDiv.style.maxWidth = '90%';
      assistantMsgDiv.style.alignSelf = 'flex-start';

      assistantMsgDiv.innerHTML = `
        <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        </div>
        <div style="background:var(--g100); color:var(--black); padding:14px 18px; border-radius:16px; font-size:0.9rem; line-height:1.6; word-break:break-word; min-width:120px;">
          <div class="ast-tool-status-area" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;"></div>
          <div class="ast-text-body">
            <div class="ast-thinking-shimmer" aria-label="Thinking">
              <div class="ast-shimmer-track">
                <div class="ast-shimmer-bar"></div>
              </div>
              <span class="ast-shimmer-text">Thinking...</span>
            </div>
          </div>
          <div class="ast-tool-results-area"></div>
        </div>
      `;

      if (messagesEl) {
        messagesEl.appendChild(assistantMsgDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      const textBody = assistantMsgDiv.querySelector?.('.ast-text-body');
      const toolStatusArea = assistantMsgDiv.querySelector?.('.ast-tool-status-area');
      const toolResultsArea = assistantMsgDiv.querySelector?.('.ast-tool-results-area');

      let accumulatedStreamText = '';
      let executedToolResults = [];

      const abortCtrl = new AbortController();
      currentAssistantAbortCtrl = abortCtrl;
      const watchdog = setTimeout(() => abortCtrl.abort(), 25000);

      try {
        const streamResult = await streamChatCompletion({
          mode: currentMode,
          history,
          turnId,
          idempotencyKey: turnId,
          systemInstruction: `User is in Toolbox workspace. Current active tool is: ${taskState.activeToolId || 'Home'}.`,
          currentFile: fileToProcess,
          taskState,
          onToken: (chunk) => {
            accumulatedStreamText += chunk;
            if (textBody) textBody.innerHTML = formatMarkdown(accumulatedStreamText);
            if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
          },
          onToolCallStart: (toolName, toolArgs) => {
            if (!toolStatusArea) return;
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
            statusCard.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#3b82f6;"></span> Executing tool: <code>${toolName}</code>...`;
            toolStatusArea.appendChild(statusCard);
          },
          onToolCallResult: (toolName, result) => {
            executedToolResults.push(result);
            if (toolResultsArea) {
              void integrationManager.renderToolResult(result, toolResultsArea, toolName);
            }
          },
          signal: abortCtrl.signal
        });

        const finalText = accumulatedStreamText || streamResult.text || (executedToolResults.length ? 'Executed action successfully.' : '');
        if (textBody) {
          textBody.innerHTML = formatMarkdown(finalText);
          
          const lower = finalText.toLowerCase();
          const needsFilePrompt = (
            lower.includes('upload') ||
            lower.includes('drag & drop') ||
            lower.includes('attach your') ||
            lower.includes('attach the') ||
            lower.includes('attach a') ||
            executedToolResults.some(r => r?.status === 'needs_file')
          );

          if (needsFilePrompt) {
            const dropDiv = document.createElement('div');
            dropDiv.className = 'ast-inchat-dropzone-card';
            dropDiv.innerHTML = `
              <div class="ast-inchat-drop-inner">
                <div class="ast-inchat-drop-icon-wrap">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style="flex:1;">
                  <div style="font-size:0.86rem; font-weight:700; color:var(--black);">Drag & drop file here</div>
                  <div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">
                    or <span class="ast-inchat-browse-btn" style="color:var(--black); font-weight:700; text-decoration:underline; cursor:pointer;">Browse device</span> (PDF, Image, CSV, Audio)
                  </div>
                </div>
              </div>
              <input type="file" class="ast-inchat-file-input" style="display:none;" />
            `;
            textBody.parentElement?.appendChild(dropDiv);

            const inFileInput = dropDiv.querySelector('.ast-inchat-file-input');
            dropDiv.addEventListener('click', () => inFileInput?.click());
            inFileInput?.addEventListener('change', (e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f, true);
            });
            dropDiv.addEventListener('dragover', (e) => {
              e.preventDefault();
              e.stopPropagation();
              dropDiv.classList.add('dragover');
            });
            dropDiv.addEventListener('dragleave', (e) => {
              e.preventDefault();
              e.stopPropagation();
              dropDiv.classList.remove('dragover');
            });
            dropDiv.addEventListener('drop', (e) => {
              e.preventDefault();
              e.stopPropagation();
              dropDiv.classList.remove('dragover');
              const f = e.dataTransfer?.files?.[0];
              if (f) handleFileSelected(f, true);
            });
          }
        }

        // 2. Commit and persist successful assistant turn
        history.push({
          id: `msg_${Date.now()}_a`,
          turnId,
          role: 'assistant',
          content: finalText,
          toolResults: executedToolResults,
          status: 'success',
          timestamp: Date.now()
        });
        persistHistory();
        updateQuotaDisplay();

      } catch (err) {
        const hasTools = executedToolResults.length > 0;
        const message = err?.name === 'AbortError'
          ? 'The request took too long. Please try again.'
          : (err?.message || 'Something went wrong.');

        const finalAssistantText = accumulatedStreamText || (hasTools ? (executedToolResults.map(r => r.message).filter(Boolean).join('\n') || 'Executed action.') : '');

        // 3. Durable state: Always commit the assistant turn even on failure
        history.push({
          id: `msg_${Date.now()}_a`,
          turnId,
          role: 'assistant',
          content: finalAssistantText,
          toolResults: executedToolResults,
          status: hasTools ? 'partial_success' : 'failed',
          error: message,
          timestamp: Date.now()
        });
        persistHistory();

        if (textBody) {
          if (hasTools) {
            textBody.innerHTML = `
              <div>${formatMarkdown(finalAssistantText)}</div>
              <div style="font-size:0.75rem; color:var(--g500); margin-top:6px; font-style:italic;">Action completed. Note: ${escapeHtml(message)}</div>
            `;
          } else {
            textBody.innerHTML = `
              <div style="color:#ef4444; font-weight:600; margin-bottom:8px; line-height:1.4;">${escapeHtml(message)}</div>
              <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                <button type="button" class="btn btn-secondary btn-sm ast-err-btn-retry" style="font-size:0.75rem; font-weight:700;">
                  Retry Request
                </button>
              </div>
            `;

            assistantMsgDiv.querySelector?.('.ast-err-btn-retry')?.addEventListener('click', () => {
              retryTurn(turnId, assistantMsgDiv);
            });
          }
        }
      } finally {
        clearTimeout(watchdog);
        currentAssistantAbortCtrl = null;
        if (sendBtn) sendBtn.disabled = false;
      }
    }

    async function retryTurn(turnId, targetMsgDiv) {
      if (!turnId) return;

      const asstIdx = history.findIndex(m => m.turnId === turnId && m.role === 'assistant');
      const userIdx = history.findIndex(m => m.turnId === turnId && m.role === 'user');
      const userMsg = userIdx !== -1 ? history[userIdx] : (asstIdx > 0 ? history[asstIdx - 1] : null);
      if (!userMsg) return;

      const assistantMsgDiv = targetMsgDiv || messagesEl?.querySelector(`.ast-msg-assistant[data-turn-id="${turnId}"]`);
      if (!assistantMsgDiv) return;

      const textBody = assistantMsgDiv.querySelector('.ast-text-body');
      const toolStatusArea = assistantMsgDiv.querySelector('.ast-tool-status-area');
      const toolResultsArea = assistantMsgDiv.querySelector('.ast-tool-results-area');

      if (toolStatusArea) toolStatusArea.innerHTML = '';
      if (toolResultsArea) toolResultsArea.innerHTML = '';
      if (textBody) {
        textBody.innerHTML = `
          <div class="ast-thinking-shimmer" aria-label="Thinking">
            <div class="ast-shimmer-track">
              <div class="ast-shimmer-bar"></div>
            </div>
            <span class="ast-shimmer-text">Thinking...</span>
          </div>
        `;
      }

      if (sendBtn) sendBtn.disabled = true;

      let accumulatedStreamText = '';
      let executedToolResults = [];

      const abortCtrl = new AbortController();
      currentAssistantAbortCtrl = abortCtrl;
      const watchdog = setTimeout(() => abortCtrl.abort(), 25000);

      // Context includes all conversation history up to this user message
      const historyContext = history.slice(0, userIdx !== -1 ? userIdx + 1 : (asstIdx !== -1 ? asstIdx : history.length));

      try {
        const streamResult = await streamChatCompletion({
          mode: currentMode,
          history: historyContext,
          turnId,
          idempotencyKey: `retry_${turnId}_${Date.now()}`,
          systemInstruction: `User is in Toolbox workspace. Current active tool is: ${taskState.activeToolId || 'Home'}.`,
          currentFile: userMsg.fileData || null,
          taskState,
          onToken: (chunk) => {
            accumulatedStreamText += chunk;
            if (textBody) textBody.innerHTML = formatMarkdown(accumulatedStreamText);
            if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
          },
          onToolCallStart: (toolName, toolArgs) => {
            if (!toolStatusArea) return;
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
            statusCard.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#3b82f6;"></span> Executing tool: <code>${toolName}</code>...`;
            toolStatusArea.appendChild(statusCard);
          },
          onToolCallResult: (toolName, result) => {
            executedToolResults.push(result);
            if (toolResultsArea) {
              void integrationManager.renderToolResult(result, toolResultsArea, toolName);
            }
          },
          signal: abortCtrl.signal
        });

        const finalText = accumulatedStreamText || streamResult.text || (executedToolResults.length ? 'Executed action successfully.' : '');
        if (textBody) {
          textBody.innerHTML = formatMarkdown(finalText);

          const lower = finalText.toLowerCase();
          const needsFilePrompt = (
            lower.includes('upload') ||
            lower.includes('drag & drop') ||
            lower.includes('attach your') ||
            lower.includes('attach the') ||
            lower.includes('attach a') ||
            executedToolResults.some(r => r?.status === 'needs_file')
          );

          if (needsFilePrompt) {
            const dropDiv = document.createElement('div');
            dropDiv.className = 'ast-inchat-dropzone-card';
            dropDiv.innerHTML = `
              <div class="ast-inchat-drop-inner">
                <div class="ast-inchat-drop-icon-wrap">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style="flex:1;">
                  <div style="font-size:0.86rem; font-weight:700; color:var(--black);">Drag & drop file here</div>
                  <div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">
                    or <span class="ast-inchat-browse-btn" style="color:var(--black); font-weight:700; text-decoration:underline; cursor:pointer;">Browse device</span> (PDF, Image, CSV, Audio)
                  </div>
                </div>
              </div>
              <input type="file" class="ast-inchat-file-input" style="display:none;" />
            `;
            textBody.parentElement?.appendChild(dropDiv);

            const inFileInput = dropDiv.querySelector('.ast-inchat-file-input');
            dropDiv.addEventListener('click', () => inFileInput?.click());
            inFileInput?.addEventListener('change', (e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f, true);
            });
          }
        }

        const updatedMsg = {
          id: `msg_${Date.now()}_a`,
          turnId,
          role: 'assistant',
          content: finalText,
          toolResults: executedToolResults,
          status: 'success',
          timestamp: Date.now()
        };

        if (asstIdx !== -1) {
          history[asstIdx] = updatedMsg;
        } else {
          history.push(updatedMsg);
        }
        persistHistory();
        updateQuotaDisplay();

      } catch (err) {
        const hasTools = executedToolResults.length > 0;
        const message = err?.name === 'AbortError'
          ? 'The request took too long. Please try again.'
          : (err?.message || 'Something went wrong.');

        const finalAssistantText = accumulatedStreamText || (hasTools ? (executedToolResults.map(r => r.message).filter(Boolean).join('\n') || 'Executed action.') : '');

        const failedMsg = {
          id: `msg_${Date.now()}_a`,
          turnId,
          role: 'assistant',
          content: finalAssistantText,
          toolResults: executedToolResults,
          status: hasTools ? 'partial_success' : 'failed',
          error: message,
          timestamp: Date.now()
        };

        if (asstIdx !== -1) {
          history[asstIdx] = failedMsg;
        } else {
          history.push(failedMsg);
        }
        persistHistory();

        if (textBody) {
          if (hasTools) {
            textBody.innerHTML = `
              <div>${formatMarkdown(finalAssistantText)}</div>
              <div style="font-size:0.75rem; color:var(--g500); margin-top:6px; font-style:italic;">Action completed. Note: ${escapeHtml(message)}</div>
            `;
          } else {
            textBody.innerHTML = `
              <div style="color:#ef4444; font-weight:600; margin-bottom:8px; line-height:1.4;">${escapeHtml(message)}</div>
              <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                <button type="button" class="btn btn-secondary btn-sm ast-err-btn-retry" style="font-size:0.75rem; font-weight:700;">
                  Retry Request
                </button>
              </div>
            `;
            assistantMsgDiv.querySelector?.('.ast-err-btn-retry')?.addEventListener('click', () => {
              retryTurn(turnId, assistantMsgDiv);
            });
          }
        }
      } finally {
        clearTimeout(watchdog);
        currentAssistantAbortCtrl = null;
        if (sendBtn) sendBtn.disabled = false;
      }
    }

    renderMessageList();

    if (keepContext) {
      void integrationManager.loadConversation().then(messages => {
        if (!messages.length || hasStartedConversation) return;
        history = integrationManager.getHistory();
        renderMessageList();
      }).catch(e => console.warn('[Assistant] Failed to load conversation:', e));
    }

    // Auto-focus input
    setTimeout(() => {
      if (typeof userInput?.focus === 'function') {
        userInput.focus();
      }
    }, 50);
  },

  destroy() {
    AssistantAudioManager.destroyAll();
  }
};
