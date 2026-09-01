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
let isSignUpMode = false;

export function openAccountModal(signUp = false) {
  isSignUpMode = signUp;
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
            <h2 class="settings-modal-title" style="font-size:1.15rem; font-weight:800;">
              ${user ? 'Account & Storage' : (isSignUpMode ? 'Create an Account' : 'Sign In')}
            </h2>
            <p class="settings-modal-subtitle">
              ${user ? 'Manage cloud sync, dual storage preferences, and AI quotas.' : (isSignUpMode ? 'Sign up to access Assistant and sync your workspaces.' : 'Sign in to access Assistant, sync files, and manage spaces.')}
            </p>
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
              <div style="font-size:0.88rem; font-weight:700; color:var(--black); margin-bottom:12px;">
                ${isSignUpMode ? 'Create a New Account' : 'Sign In with Email'}
              </div>
              <form id="auth-form" style="display:flex; flex-direction:column; gap:10px;" onsubmit="return false;">
                <input type="email" id="auth-email-input" class="tool-input" placeholder="Enter your email..." required style="width:100%; padding:10px 12px; font-size:0.88rem; border-radius:8px;">
                <input type="password" id="auth-pwd-input" class="tool-input" placeholder="Enter your password..." required style="width:100%; padding:10px 12px; font-size:0.88rem; border-radius:8px;">
                
                <button type="submit" class="btn btn-primary btn-sm" id="btn-auth-submit" style="width:100%; padding:10px; font-weight:600; font-size:0.9rem; margin-top:4px;">
                  ${isSignUpMode ? 'Create Account' : 'Sign In'}
                </button>
                
                <div id="auth-msg" style="font-size:0.8rem; line-height:1.4; display:none; padding:4px 0;"></div>
                
                <div style="text-align:center; font-size:0.82rem; color:var(--g600); margin-top:6px;">
                  ${isSignUpMode ? `
                    Already have an account? <button type="button" id="btn-toggle-auth" style="background:none; border:none; padding:0; color:var(--accent, #3b82f6); font-weight:600; cursor:pointer; text-decoration:underline;">Sign in</button>
                  ` : `
                    Don't have an account? <button type="button" id="btn-toggle-auth" style="background:none; border:none; padding:0; color:var(--accent, #3b82f6); font-weight:600; cursor:pointer; text-decoration:underline;">Create one</button>
                  `}
                </div>
              </form>
            </div>
          `}
        </div>

        ${user ? `
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
        ` : ''}

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

  const btnToggleAuth = modalEl.querySelector('#btn-toggle-auth');
  if (btnToggleAuth) {
    btnToggleAuth.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      renderModalContent();
      const emailInput = modalEl.querySelector('#auth-email-input');
      if (emailInput) emailInput.focus();
    });
  }

  const authForm = modalEl.querySelector('#auth-form');
  const emailIn = modalEl.querySelector('#auth-email-input');
  const pwdIn = modalEl.querySelector('#auth-pwd-input');
  const authMsg = modalEl.querySelector('#auth-msg');
  const btnSubmit = modalEl.querySelector('#btn-auth-submit');

  if (authForm && btnSubmit) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailIn.value.trim();
      const pwd = pwdIn.value.trim();

      if (!email || !pwd) {
        authMsg.style.display = 'block';
        authMsg.style.color = '#ef4444';
        authMsg.textContent = 'Please enter both email and password.';
        return;
      }

      authMsg.style.display = 'none';
      btnSubmit.disabled = true;
      const originalText = btnSubmit.textContent;
      btnSubmit.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';

      try {
        if (isSignUpMode) {
          const res = await signUpWithEmail(email, pwd);
          if (res.success) {
            if (res.requiresConfirmation) {
              authMsg.style.display = 'block';
              authMsg.style.color = '#10b981';
              authMsg.textContent = 'Account created! Please check your email inbox to confirm your account before signing in.';
              btnSubmit.textContent = originalText;
              btnSubmit.disabled = false;
            } else {
              closeAccountModal();
              window.location.hash = '#assistant';
            }
          } else {
            authMsg.style.display = 'block';
            authMsg.style.color = '#ef4444';
            authMsg.textContent = res.error || 'Failed to create account.';
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
          }
        } else {
          const res = await signInWithEmail(email, pwd);
          if (res.success) {
            closeAccountModal();
            window.location.hash = '#assistant';
          } else {
            authMsg.style.display = 'block';
            authMsg.style.color = '#ef4444';
            authMsg.textContent = res.error || 'Invalid credentials or login failed.';
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
          }
        }
      } catch (err) {
        authMsg.style.display = 'block';
        authMsg.style.color = '#ef4444';
        authMsg.textContent = err.message || 'An unexpected error occurred.';
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
      }
    });
  }
}
