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
  resetPassword,
  updateUserPassword,
  getUserFromToken,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../lib/supabase.js';
import { QuotaManager } from '../lib/quota-manager.js';
import { openSettings } from '../lib/settings-ui.js';

let modalEl = null;
let authMode = 'signin'; // 'signin' | 'signup' | 'reset' | 'set-new-password'
let recoveryContext = null;

export async function openAccountModal(modeOrSignUp = false, context = null) {
  if (typeof modeOrSignUp === 'string') {
    authMode = modeOrSignUp;
  } else {
    authMode = modeOrSignUp ? 'signup' : 'signin';
  }
  recoveryContext = context;

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

  if (authMode === 'set-new-password' && recoveryContext?.accessToken && !recoveryContext.email) {
    try {
      const u = await getUserFromToken(recoveryContext.accessToken);
      if (u?.email) {
        recoveryContext.email = u.email;
        const sub = modalEl.querySelector('.settings-modal-subtitle');
        if (sub) sub.textContent = `Choose a new password for ${u.email}.`;
        const emailLabel = modalEl.querySelector('#set-pwd-email-label');
        if (emailLabel) emailLabel.textContent = u.email;
      }
    } catch {}
  }
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
              ${(user && authMode !== 'set-new-password') ? 'Account & Storage' : (authMode === 'set-new-password' ? 'Set New Password' : (authMode === 'reset' ? 'Reset Password' : (authMode === 'signup' ? 'Create an Account' : 'Sign In')))}
            </h2>
            <p class="settings-modal-subtitle">
              ${(user && authMode !== 'set-new-password') ? 'Manage cloud sync, dual storage preferences, and AI quotas.' : (authMode === 'set-new-password' ? (recoveryContext?.email ? `Choose a new password for ${recoveryContext.email}.` : 'Choose a new password for your account.') : (authMode === 'reset' ? 'Enter your email to receive a password recovery link.' : (authMode === 'signup' ? 'Sign up to access Assistant and sync your workspaces.' : 'Sign in to access Assistant, sync files, and manage spaces.')))}
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
          ${(user && authMode !== 'set-new-password') ? `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.75rem; color:var(--g500); font-weight:600;">SIGNED IN AS</div>
                <div style="font-size:0.95rem; font-weight:700; color:var(--black); margin-top:2px;">${user.email}</div>
                <div style="font-size:0.72rem; color:var(--g600); font-family:monospace; margin-top:2px;">ID: ${user.id}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-auth-signout" style="color:#ef4444;">Sign Out</button>
            </div>
          ` : (authMode === 'set-new-password' ? `
            <div>
              <div style="font-size:0.88rem; font-weight:700; color:var(--black); margin-bottom:4px;">
                Set New Password
              </div>
              <div style="font-size:0.8rem; color:var(--g600); margin-bottom:14px; line-height:1.5;">
                ${recoveryContext?.email ? `Update password for <strong id="set-pwd-email-label" style="color:var(--black);">${recoveryContext.email}</strong>.` : 'Enter and confirm your new password below.'}
              </div>
              <form id="set-pwd-form" style="display:flex; flex-direction:column; gap:10px;">
                <div style="position:relative;">
                  <input type="password" id="new-pwd-input" class="tool-input" placeholder="New password..." required minlength="6" style="width:100%; padding:10px 36px 10px 12px; font-size:0.88rem; border-radius:8px;">
                  <button type="button" class="pwd-toggle-btn" data-target="new-pwd-input" aria-label="Show password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; padding:2px; cursor:pointer; color:var(--g500); display:flex; align-items:center;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-open">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-closed" style="display:none;">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                    </svg>
                  </button>
                </div>

                <div id="new-pwd-strength-container" style="margin-top:-2px; margin-bottom:2px; display:none;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:0.72rem; color:var(--g500);">Strength:</span>
                    <span id="new-pwd-strength-label" style="font-size:0.72rem; font-weight:600; color:var(--g500);">Weak</span>
                  </div>
                  <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; height:4px;">
                    <div class="new-pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                    <div class="new-pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                    <div class="new-pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                    <div class="new-pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                  </div>
                </div>

                <div style="position:relative;">
                  <input type="password" id="new-pwd-confirm-input" class="tool-input" placeholder="Confirm new password..." required minlength="6" style="width:100%; padding:10px 36px 10px 12px; font-size:0.88rem; border-radius:8px;">
                  <button type="button" class="pwd-toggle-btn" data-target="new-pwd-confirm-input" aria-label="Show password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; padding:2px; cursor:pointer; color:var(--g500); display:flex; align-items:center;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-open">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-closed" style="display:none;">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                    </svg>
                  </button>
                </div>
                <div id="new-pwd-match-hint" style="font-size:0.72rem; color:var(--g500); margin-top:-4px;">Password must be at least 6 characters.</div>

                <button type="submit" class="btn btn-primary btn-sm" id="btn-set-pwd-submit" style="width:100%; padding:10px; font-weight:600; font-size:0.9rem; margin-top:4px;">
                  Update Password
                </button>

                <div id="set-pwd-msg" style="font-size:0.8rem; line-height:1.4; display:none; padding:4px 0;"></div>
              </form>
            </div>
          ` : (authMode === 'reset' ? `
            <div>
              <div style="font-size:0.88rem; font-weight:700; color:var(--black); margin-bottom:4px;">
                Reset Your Password
              </div>
              <div style="font-size:0.8rem; color:var(--g600); margin-bottom:14px; line-height:1.5;">
                Enter the email address associated with your account and we will send you a recovery link.
              </div>
              <form id="reset-form" style="display:flex; flex-direction:column; gap:12px;">
                <input type="email" id="reset-email-input" class="tool-input" placeholder="Enter your email..." required style="width:100%; padding:10px 12px; font-size:0.88rem; border-radius:8px;">
                
                <button type="submit" class="btn btn-primary btn-sm" id="btn-reset-submit" style="width:100%; padding:10px; font-weight:600; font-size:0.9rem;">
                  Send Reset Link
                </button>
                
                <div id="reset-msg" style="font-size:0.8rem; line-height:1.4; display:none; padding:4px 0;"></div>
                
                <div style="text-align:center; font-size:0.82rem; color:var(--g600); margin-top:4px;">
                  Remember your password? <button type="button" id="btn-back-to-signin" style="background:none; border:none; padding:0; color:var(--accent, #3b82f6); font-weight:600; cursor:pointer; text-decoration:underline;">Back to sign in</button>
                </div>
              </form>
            </div>
          ` : `
            <div>
              <div style="font-size:0.88rem; font-weight:700; color:var(--black); margin-bottom:12px;">
                ${authMode === 'signup' ? 'Create a New Account' : 'Sign In with Email'}
              </div>
              <form id="auth-form" style="display:flex; flex-direction:column; gap:10px;">
                <input type="email" id="auth-email-input" class="tool-input" placeholder="Enter your email..." required style="width:100%; padding:10px 12px; font-size:0.88rem; border-radius:8px;">
                
                <div style="position:relative;">
                  <input type="password" id="auth-pwd-input" class="tool-input" placeholder="Enter your password..." required minlength="6" style="width:100%; padding:10px 36px 10px 12px; font-size:0.88rem; border-radius:8px;">
                  <button type="button" class="pwd-toggle-btn" data-target="auth-pwd-input" aria-label="Show password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; padding:2px; cursor:pointer; color:var(--g500); display:flex; align-items:center;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-open">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-closed" style="display:none;">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                    </svg>
                  </button>
                </div>

                ${authMode === 'signup' ? `
                  <div id="pwd-strength-container" style="margin-top:-2px; margin-bottom:2px; display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <span style="font-size:0.72rem; color:var(--g500);">Strength:</span>
                      <span id="pwd-strength-label" style="font-size:0.72rem; font-weight:600; color:var(--g500);">Weak</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; height:4px;">
                      <div class="pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                      <div class="pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                      <div class="pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                      <div class="pwd-meter-bar" style="background:var(--g200); border-radius:2px; height:100%; transition:background 0.2s ease;"></div>
                    </div>
                  </div>

                  <div style="position:relative;">
                    <input type="password" id="auth-pwd-confirm-input" class="tool-input" placeholder="Confirm your password..." required minlength="6" style="width:100%; padding:10px 36px 10px 12px; font-size:0.88rem; border-radius:8px;">
                    <button type="button" class="pwd-toggle-btn" data-target="auth-pwd-confirm-input" aria-label="Show password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; padding:2px; cursor:pointer; color:var(--g500); display:flex; align-items:center;">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-open">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon-closed" style="display:none;">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                      </svg>
                    </button>
                  </div>
                  <div id="pwd-match-hint" style="font-size:0.72rem; color:var(--g500); margin-top:-4px;">Password must be at least 6 characters.</div>
                ` : `
                  <div style="text-align:right; margin-top:-4px;">
                    <button type="button" id="btn-forgot-password" style="background:none; border:none; padding:0; color:var(--accent, #3b82f6); font-size:0.78rem; font-weight:500; cursor:pointer; text-decoration:none;">Forgot password?</button>
                  </div>
                `}

                <button type="submit" class="btn btn-primary btn-sm" id="btn-auth-submit" style="width:100%; padding:10px; font-weight:600; font-size:0.9rem; margin-top:4px;">
                  ${authMode === 'signup' ? 'Create Account' : 'Sign In'}
                </button>
                
                <div id="auth-msg" style="font-size:0.8rem; line-height:1.4; display:none; padding:4px 0;"></div>
                
                <div style="text-align:center; font-size:0.82rem; color:var(--g600); margin-top:6px;">
                  ${authMode === 'signup' ? `
                    Already have an account? <button type="button" id="btn-toggle-auth" style="background:none; border:none; padding:0; color:var(--accent, #3b82f6); font-weight:600; cursor:pointer; text-decoration:underline;">Sign in</button>
                  ` : `
                    Don't have an account? <button type="button" id="btn-toggle-auth" style="background:none; border:none; padding:0; color:var(--accent, #3b82f6); font-weight:600; cursor:pointer; text-decoration:underline;">Create one</button>
                  `}
                </div>
              </form>
            </div>
          `))}
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
      authMode = authMode === 'signup' ? 'signin' : 'signup';
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

  // --- Password show/hide toggles ---
  modalEl.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = modalEl.querySelector(`#${targetId}`);
      if (!input) return;
      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      const openIcon = btn.querySelector('.eye-icon-open');
      const closedIcon = btn.querySelector('.eye-icon-closed');
      if (openIcon) openIcon.style.display = isVisible ? '' : 'none';
      if (closedIcon) closedIcon.style.display = isVisible ? 'none' : '';
      btn.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    });
  });

  // --- Password strength and confirmation indicators (Sign Up mode) ---
  if (authMode === 'signup') {
    const strengthContainer = modalEl.querySelector('#pwd-strength-container');
    const strengthLabel = modalEl.querySelector('#pwd-strength-label');
    const meterBars = modalEl.querySelectorAll('.pwd-meter-bar');
    const pwdConfirmIn = modalEl.querySelector('#auth-pwd-confirm-input');
    const matchHint = modalEl.querySelector('#pwd-match-hint');

    const updateStrength = () => {
      const val = pwdIn?.value || '';
      if (!val) {
        if (strengthContainer) strengthContainer.style.display = 'none';
        return;
      }
      if (strengthContainer) strengthContainer.style.display = 'block';

      let score = 0;
      if (val.length >= 6) score += 1;
      if (val.length >= 10) score += 1;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
      if (/[0-9]/.test(val)) score += 0.5;
      if (/[^A-Za-z0-9]/.test(val)) score += 0.5;

      let level = 1;
      let label = 'Weak';
      let color = '#ef4444';

      if (score < 1.5) {
        level = 1;
        label = 'Weak';
        color = '#ef4444';
      } else if (score < 2.5) {
        level = 2;
        label = 'Fair';
        color = '#f59e0b';
      } else if (score < 3.5) {
        level = 3;
        label = 'Good';
        color = '#3b82f6';
      } else {
        level = 4;
        label = 'Strong';
        color = '#10b981';
      }

      if (strengthLabel) {
        strengthLabel.textContent = label;
        strengthLabel.style.color = color;
      }

      meterBars.forEach((bar, idx) => {
        bar.style.background = idx < level ? color : 'var(--g200)';
      });
    };

    const updateMatch = () => {
      if (!matchHint) return;
      const p1 = pwdIn?.value || '';
      const p2 = pwdConfirmIn?.value || '';
      if (!p2) {
        matchHint.textContent = 'Password must be at least 6 characters.';
        matchHint.style.color = 'var(--g500)';
        return;
      }
      if (p1 === p2) {
        matchHint.textContent = 'Passwords match.';
        matchHint.style.color = '#10b981';
      } else {
        matchHint.textContent = 'Passwords do not match.';
        matchHint.style.color = '#ef4444';
      }
    };

    if (pwdIn) {
      pwdIn.addEventListener('input', () => {
        updateStrength();
        updateMatch();
      });
    }
    if (pwdConfirmIn) {
      pwdConfirmIn.addEventListener('input', updateMatch);
    }
  }

  // --- Set New Password Form Handlers ---
  const setPwdForm = modalEl.querySelector('#set-pwd-form');
  const newPwdIn = modalEl.querySelector('#new-pwd-input');
  const newPwdConfirmIn = modalEl.querySelector('#new-pwd-confirm-input');
  const btnSetPwdSubmit = modalEl.querySelector('#btn-set-pwd-submit');
  const setPwdMsg = modalEl.querySelector('#set-pwd-msg');

  if (setPwdForm && btnSetPwdSubmit) {
    const strengthContainer = modalEl.querySelector('#new-pwd-strength-container');
    const strengthLabel = modalEl.querySelector('#new-pwd-strength-label');
    const meterBars = modalEl.querySelectorAll('.new-pwd-meter-bar');
    const matchHint = modalEl.querySelector('#new-pwd-match-hint');

    const updateStrength = () => {
      const val = newPwdIn?.value || '';
      if (!val) {
        if (strengthContainer) strengthContainer.style.display = 'none';
        return;
      }
      if (strengthContainer) strengthContainer.style.display = 'block';

      let score = 0;
      if (val.length >= 6) score += 1;
      if (val.length >= 10) score += 1;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
      if (/[0-9]/.test(val)) score += 0.5;
      if (/[^A-Za-z0-9]/.test(val)) score += 0.5;

      let level = 1;
      let label = 'Weak';
      let color = '#ef4444';

      if (score < 1.5) {
        level = 1; label = 'Weak'; color = '#ef4444';
      } else if (score < 2.5) {
        level = 2; label = 'Fair'; color = '#f59e0b';
      } else if (score < 3.5) {
        level = 3; label = 'Good'; color = '#3b82f6';
      } else {
        level = 4; label = 'Strong'; color = '#10b981';
      }

      if (strengthLabel) {
        strengthLabel.textContent = label;
        strengthLabel.style.color = color;
      }

      meterBars.forEach((bar, idx) => {
        bar.style.background = idx < level ? color : 'var(--g200)';
      });
    };

    const updateMatch = () => {
      if (!matchHint) return;
      const p1 = newPwdIn?.value || '';
      const p2 = newPwdConfirmIn?.value || '';
      if (!p2) {
        matchHint.textContent = 'Password must be at least 6 characters.';
        matchHint.style.color = 'var(--g500)';
        return;
      }
      if (p1 === p2) {
        matchHint.textContent = 'Passwords match.';
        matchHint.style.color = '#10b981';
      } else {
        matchHint.textContent = 'Passwords do not match.';
        matchHint.style.color = '#ef4444';
      }
    };

    if (newPwdIn) {
      newPwdIn.addEventListener('input', () => {
        updateStrength();
        updateMatch();
      });
    }
    if (newPwdConfirmIn) {
      newPwdConfirmIn.addEventListener('input', updateMatch);
    }

    setPwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = newPwdIn?.value || '';
      const p2 = newPwdConfirmIn?.value || '';

      if (!p1 || p1.length < 6) {
        if (setPwdMsg) {
          setPwdMsg.style.display = 'block';
          setPwdMsg.style.color = '#ef4444';
          setPwdMsg.textContent = 'Password must be at least 6 characters.';
        }
        return;
      }

      if (p1 !== p2) {
        if (setPwdMsg) {
          setPwdMsg.style.display = 'block';
          setPwdMsg.style.color = '#ef4444';
          setPwdMsg.textContent = 'Passwords do not match.';
        }
        return;
      }

      btnSetPwdSubmit.disabled = true;
      btnSetPwdSubmit.textContent = 'Updating...';
      if (setPwdMsg) setPwdMsg.style.display = 'none';

      try {
        const token = recoveryContext?.accessToken;
        const res = await updateUserPassword(p1, token);
        if (res.success) {
          if (setPwdMsg) {
            setPwdMsg.style.display = 'block';
            setPwdMsg.style.color = '#10b981';
            setPwdMsg.textContent = 'Password updated successfully! Signing you in...';
          }
          recoveryContext = null;
          authMode = 'signin';
          setTimeout(() => {
            renderModalContent();
          }, 1200);
        } else {
          if (setPwdMsg) {
            setPwdMsg.style.display = 'block';
            setPwdMsg.style.color = '#ef4444';
            setPwdMsg.textContent = res.error || 'Failed to update password.';
          }
          btnSetPwdSubmit.disabled = false;
          btnSetPwdSubmit.textContent = 'Update Password';
        }
      } catch (err) {
        if (setPwdMsg) {
          setPwdMsg.style.display = 'block';
          setPwdMsg.style.color = '#ef4444';
          setPwdMsg.textContent = err.message || 'Failed to update password.';
        }
        btnSetPwdSubmit.disabled = false;
        btnSetPwdSubmit.textContent = 'Update Password';
      }
    });
  }

  // --- Reset Password Form (Dedicated view) ---
  const resetForm = modalEl.querySelector('#reset-form');
  const resetEmailIn = modalEl.querySelector('#reset-email-input');
  const btnResetSubmit = modalEl.querySelector('#btn-reset-submit');
  const resetMsg = modalEl.querySelector('#reset-msg');
  const btnBackToSignin = modalEl.querySelector('#btn-back-to-signin');

  if (resetForm && btnResetSubmit) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resetEmail = resetEmailIn?.value?.trim();
      if (!resetEmail) {
        if (resetMsg) {
          resetMsg.style.display = 'block';
          resetMsg.style.color = '#ef4444';
          resetMsg.textContent = 'Please enter your email address.';
        }
        return;
      }
      btnResetSubmit.disabled = true;
      btnResetSubmit.textContent = 'Sending...';
      if (resetMsg) resetMsg.style.display = 'none';

      try {
        const res = await resetPassword(resetEmail);
        if (resetMsg) {
          resetMsg.style.display = 'block';
          if (res.success) {
            resetMsg.style.color = '#10b981';
            resetMsg.textContent = 'Password reset link sent! Check your email inbox.';
          } else {
            resetMsg.style.color = '#ef4444';
            resetMsg.textContent = res.error || 'Failed to send reset link.';
          }
        }
      } catch (err) {
        if (resetMsg) {
          resetMsg.style.display = 'block';
          resetMsg.style.color = '#ef4444';
          resetMsg.textContent = err.message || 'Failed to send reset link.';
        }
      } finally {
        btnResetSubmit.disabled = false;
        btnResetSubmit.textContent = 'Send Reset Link';
      }
    });
  }

  if (btnBackToSignin) {
    btnBackToSignin.addEventListener('click', () => {
      authMode = 'signin';
      renderModalContent();
      const emailInput = modalEl.querySelector('#auth-email-input');
      if (emailInput) emailInput.focus();
    });
  }

  // --- Switch to Reset Password view ---
  const btnForgot = modalEl.querySelector('#btn-forgot-password');
  if (btnForgot) {
    btnForgot.addEventListener('click', () => {
      const emailVal = emailIn?.value?.trim() || '';
      authMode = 'reset';
      renderModalContent();
      const resetEmailInput = modalEl.querySelector('#reset-email-input');
      if (resetEmailInput) {
        if (emailVal) resetEmailInput.value = emailVal;
        resetEmailInput.focus();
      }
    });
  }

  // --- Form submission ---
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

      const isSignUp = authMode === 'signup';

      // Confirm password validation for sign-up
      if (isSignUp) {
        const pwdConfirmIn = modalEl.querySelector('#auth-pwd-confirm-input');
        const confirmPwd = pwdConfirmIn?.value?.trim() || '';
        if (pwd !== confirmPwd) {
          authMsg.style.display = 'block';
          authMsg.style.color = '#ef4444';
          authMsg.textContent = 'Passwords do not match.';
          if (pwdConfirmIn) pwdConfirmIn.focus();
          return;
        }
        if (pwd.length < 6) {
          authMsg.style.display = 'block';
          authMsg.style.color = '#ef4444';
          authMsg.textContent = 'Password must be at least 6 characters.';
          return;
        }
      }

      authMsg.style.display = 'none';
      btnSubmit.disabled = true;
      const originalText = btnSubmit.textContent;
      btnSubmit.textContent = isSignUp ? 'Creating Account...' : 'Signing In...';

      try {
        if (isSignUp) {
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
