/* ============================================================
   TOOLBOX — Account & Cloud Sync Modal
   Manages Supabase Auth, User Profile, Dual Storage Mode Switcher,
   and live Quota & Rate Limit breakdowns.
   ============================================================ */

import { getCurrentUser, signInWithEmail, signUpWithEmail, signOut, getStorageMode, setStorageMode } from '../lib/supabase.js';
import { QuotaManager } from '../lib/quota-manager.js';

let modalEl = null;

export function openAccountModal() {
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'account-modal';
    modalEl.className = 'settings-modal-backdrop';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.style.display = 'none';
    document.body.appendChild(modalEl);
  }

  renderModalContent();
  modalEl.style.display = 'flex';
  modalEl.classList.add('is-open');
}

export function closeAccountModal() {
  if (modalEl) {
    modalEl.style.display = 'none';
    modalEl.classList.remove('is-open');
  }
}

function renderModalContent() {
  const user = getCurrentUser();
  const storageMode = getStorageMode();
  const quota = QuotaManager.getQuotaSummary();

  modalEl.innerHTML = `
    <div class="settings-modal-window" style="max-width:540px; border-radius:18px;">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      
      <div class="settings-modal-header" style="padding-bottom:12px; border-bottom:1px solid var(--g200);">
        <div class="settings-title-wrap">
          <div class="settings-title-icon" style="background:var(--black); color:var(--white);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div>
            <h2 class="settings-modal-title" style="font-size:1.15rem; font-weight:800;">Account &amp; Storage Engine</h2>
            <p class="settings-modal-subtitle">Manage cloud sync, dual storage preferences, and AI quotas.</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-account-modal" aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body" style="padding:20px; display:flex; flex-direction:column; gap:20px;">
        
        <!-- USER AUTH CARD -->
        <div style="background:var(--g50); border:1px solid var(--g200); border-radius:14px; padding:16px;">
          ${user ? `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.75rem; color:var(--g500); font-weight:600;">SIGNED IN AS</div>
                <div style="font-size:0.95rem; font-weight:700; color:var(--black); margin-top:2px;">${user.email}</div>
                <div style="font-size:0.72rem; color:var(--g600); font-family:monospace; margin-top:2px;">ID: ${user.id}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-auth-signout" style="color:#ef4444;">Sign Out</button>
            </div>
          ` : `
            <div>
              <div style="font-size:0.88rem; font-weight:700; color:var(--black); margin-bottom:8px;">Sign in to Sync Files &amp; Spaces</div>
              <div style="display:flex; flex-direction:column; gap:10px;" id="auth-form-wrap">
                <input type="email" id="auth-email-input" class="tool-input" placeholder="Enter your email..." style="width:100%; padding:8px 12px; font-size:0.86rem; border-radius:8px;">
                <input type="password" id="auth-pwd-input" class="tool-input" placeholder="Enter your password..." style="width:100%; padding:8px 12px; font-size:0.86rem; border-radius:8px;">
                <div style="display:flex; gap:8px;">
                  <button type="button" class="btn btn-primary btn-sm" id="btn-auth-signin" style="flex:1;">Sign In</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-auth-signup" style="flex:1;">Create Account</button>
                </div>
                <div id="auth-msg" style="font-size:0.75rem; color:#ef4444; display:none;"></div>
              </div>
            </div>
          `}
        </div>

        <!-- DUAL STORAGE ENGINE SWITCHER -->
        <div>
          <div style="font-size:0.86rem; font-weight:700; color:var(--black); margin-bottom:6px;">Storage Strategy</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="storage-card ${storageMode === 'local' ? 'active' : ''}" id="opt-storage-local" style="border:2px solid ${storageMode === 'local' ? 'var(--black)' : 'var(--g200)'}; background:${storageMode === 'local' ? 'var(--g100)' : 'var(--white)'}; border-radius:12px; padding:12px; cursor:pointer; transition:all 0.2s;">
              <div style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:0.84rem; color:var(--black);">
                <span>⚡ Local Device</span>
                ${storageMode === 'local' ? '<span style="font-size:0.65rem; background:var(--black); color:#fff; padding:1px 5px; border-radius:999px;">Active</span>' : ''}
              </div>
              <p style="margin:4px 0 0; font-size:0.74rem; color:var(--g600); line-height:1.4;">Zero latency, 100% offline, files stay in your browser disk.</p>
            </div>

            <div class="storage-card ${storageMode === 'supabase' ? 'active' : ''}" id="opt-storage-supabase" style="border:2px solid ${storageMode === 'supabase' ? 'var(--black)' : 'var(--g200)'}; background:${storageMode === 'supabase' ? 'var(--g100)' : 'var(--white)'}; border-radius:12px; padding:12px; cursor:pointer; transition:all 0.2s;">
              <div style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:0.84rem; color:var(--black);">
                <span>☁️ Supabase Cloud</span>
                ${storageMode === 'supabase' ? '<span style="font-size:0.65rem; background:var(--black); color:#fff; padding:1px 5px; border-radius:999px;">Active</span>' : ''}
              </div>
              <p style="margin:4px 0 0; font-size:0.74rem; color:var(--g600); line-height:1.4;">Non-volatile, persistent, accessible across devices.</p>
            </div>
          </div>
        </div>

        <!-- OPTIONAL API KEY OVERRIDE -->
        <div>
          <div style="font-size:0.86rem; font-weight:700; color:var(--black); margin-bottom:6px;">Google Gemini API Key (Custom Override)</div>
          <p style="margin:0 0 8px; font-size:0.75rem; color:var(--g600); line-height:1.4;">
            Toolbox includes backend proxy AI capabilities out-of-the-box. You can also provide your own personal key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color:var(--black); font-weight:700; text-decoration:underline;">Google AI Studio</a>.
          </p>
          <div style="display:flex; gap:8px;">
            <input type="password" id="custom-api-key-input" class="tool-input" placeholder="AIzaSy..." value="${localStorage.getItem('toolbox_assistant_api_key') || ''}" style="flex:1; padding:8px 12px; font-size:0.84rem; font-family:monospace; border-radius:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-save-api-key">Save Key</button>
          </div>
          <div id="api-key-save-msg" style="font-size:0.75rem; color:#22c55e; margin-top:4px; display:none;">Saved!</div>
        </div>

        <!-- QUOTA & RATE LIMITS SUMMARY -->
        <div style="background:var(--g50); border:1px solid var(--g200); border-radius:14px; padding:14px;">
          <div style="font-size:0.82rem; font-weight:700; color:var(--black); margin-bottom:8px; display:flex; justify-content:space-between;">
            <span>AI Assistant Quotas &amp; Limits</span>
            <span style="color:#22c55e;">Active</span>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:8px; font-size:0.78rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--g700);">Daily Messages</span>
              <span style="font-weight:700; font-family:monospace;">${quota.messagesUsed} / ${quota.messagesLimit} (${quota.messagesRemaining} remaining)</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--g700);">Burst Rate Limit</span>
              <span style="font-weight:700; font-family:monospace;">${quota.burstLimit} msgs / min</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--g700);">Max Tokens per Request</span>
              <span style="font-weight:700; font-family:monospace;">${quota.maxOutputTokens} tokens</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--g700);">Heavy Tool Tasks</span>
              <span style="font-weight:700; font-family:monospace;">${quota.heavyTasksUsed} / ${quota.heavyTasksLimit} today</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--g700);">Large File Analyses</span>
              <span style="font-weight:700; font-family:monospace;">${quota.largeFilesUsed} / ${quota.largeFilesLimit} today</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Attach handlers
  modalEl.querySelector('#close-account-modal').addEventListener('click', closeAccountModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAccountModal();
  });

  const btnSignout = modalEl.querySelector('#btn-auth-signout');
  if (btnSignout) {
    btnSignout.addEventListener('click', () => {
      signOut();
      renderModalContent();
    });
  }

  const btnSignin = modalEl.querySelector('#btn-auth-signin');
  const btnSignup = modalEl.querySelector('#btn-auth-signup');
  const emailIn = modalEl.querySelector('#auth-email-input');
  const pwdIn = modalEl.querySelector('#auth-pwd-input');
  const authMsg = modalEl.querySelector('#auth-msg');

  if (btnSignin && btnSignup) {
    btnSignin.addEventListener('click', async () => {
      const email = emailIn.value.trim();
      const pwd = pwdIn.value.trim();
      if (!email || !pwd) {
        authMsg.style.display = 'block';
        authMsg.textContent = 'Please enter both email and password.';
        return;
      }
      const res = await signInWithEmail(email, pwd);
      if (res.success) {
        renderModalContent();
      } else {
        authMsg.style.display = 'block';
        authMsg.textContent = res.error;
      }
    });

    btnSignup.addEventListener('click', async () => {
      const email = emailIn.value.trim();
      const pwd = pwdIn.value.trim();
      if (!email || !pwd) {
        authMsg.style.display = 'block';
        authMsg.textContent = 'Please enter both email and password.';
        return;
      }
      const res = await signUpWithEmail(email, pwd);
      if (res.success) {
        renderModalContent();
      } else {
        authMsg.style.display = 'block';
        authMsg.textContent = res.error;
      }
    });
  }

  // Storage cards
  modalEl.querySelector('#opt-storage-local').addEventListener('click', () => {
    setStorageMode('local');
    renderModalContent();
  });

  modalEl.querySelector('#opt-storage-supabase').addEventListener('click', () => {
    setStorageMode('supabase');
    renderModalContent();
  });

  const btnSaveKey = modalEl.querySelector('#btn-save-api-key');
  const keyInput = modalEl.querySelector('#custom-api-key-input');
  const keyMsg = modalEl.querySelector('#api-key-save-msg');
  if (btnSaveKey && keyInput) {
    btnSaveKey.addEventListener('click', () => {
      const val = keyInput.value.trim();
      if (val) {
        localStorage.setItem('toolbox_assistant_api_key', val);
      } else {
        localStorage.removeItem('toolbox_assistant_api_key');
      }
      keyMsg.style.display = 'block';
      setTimeout(() => { keyMsg.style.display = 'none'; }, 2000);
    });
  }
}
