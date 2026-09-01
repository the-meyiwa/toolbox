/* ============================================================
   TOOLBOX — Account & Cloud Sync Modal
   Manages Supabase Auth, User Profile, Dual Storage Mode Switcher,
   Supabase Project Keys, and live Quota & Rate Limit breakdowns.
   ============================================================ */

import {
  getCurrentUser,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../lib/supabase.js';
import { QuotaManager } from '../lib/quota-manager.js';
import { openSettings } from '../lib/settings-ui.js';

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
  const quota = QuotaManager.getQuotaSummary();
  const supabaseConfig = getSupabaseConfig();

  modalEl.innerHTML = `
    <div class="settings-modal-window" style="max-width:560px; border-radius:18px;">
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

      <div class="settings-modal-body" style="padding:20px; display:flex; flex-direction:column; gap:18px; max-height:calc(85vh - 80px); overflow-y:auto;">
        
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

        </div>


        <!-- QUOTA & RATE LIMITS SUMMARY -->
        <div style="background:var(--g50); border:1px solid var(--g200); border-radius:14px; padding:14px;">
          <div style="font-size:0.82rem; font-weight:700; color:var(--black); margin-bottom:8px; display:flex; justify-content:space-between;">
            <span>Account Quotas &amp; Limits</span>
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
      authMsg.style.display = 'none';
      const res = await signInWithEmail(email, pwd);
      if (res.success) {
        closeAccountModal();
        window.location.hash = '#assistant';
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
      authMsg.style.display = 'none';
      const res = await signUpWithEmail(email, pwd);
      if (res.success) {
        closeAccountModal();
        window.location.hash = '#assistant';
      } else {
        authMsg.style.display = 'block';
        authMsg.textContent = res.error;
      }
    });
  }


}
