/* ============================================================
   TOOLBOX — Mail account connection
   Used by the Mail tool (no account yet), Preferences → Mail and the
   sign-up onboarding step. OAuth runs in a popup; the server's
   callback posts { type: 'toolbox:mail-oauth-success', accountId }
   back to this window.
   ============================================================ */

import { getCurrentUser } from '../lib/supabase.js';
import { openAccountModal } from './account-modal.js';
import { mailApi } from '../lib/mail-provider.js';

export function detectMailProvider(email = '') {
  const domain = String(email).toLowerCase().split('@')[1] || '';
  if (/(outlook|hotmail|live|msn|microsoft|office365)/.test(domain)) return 'microsoft';
  return 'google';
}

const providerName = provider => provider === 'microsoft' ? 'Microsoft' : 'Google';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>';
const ICON_GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.45-1.7 4.25-5.35 4.25-3.2 0-5.8-2.65-5.8-5.9s2.6-5.9 5.8-5.9c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.7 3.95 14.55 3 12 3 6.95 3 3 7.05 3 12s3.95 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.1-1.05-.3-1.1z"/></svg>';
const ICON_MS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" opacity=".9"/></svg>';
const ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/**
 * Start the OAuth popup for a provider. Resolves with the new account id,
 * or rejects with a readable error. Shared with the Mail tool's "Add account".
 */
export function connectMailbox(provider, { hint = '' } = {}) {
  return new Promise((resolve, reject) => {
    const popup = window.open('about:blank', `toolbox-mail-${provider}`, 'width=520,height=680');
    if (!popup) { reject(new Error('Allow pop-ups for Toolbox to connect your mailbox.')); return; }
    try {
      popup.document.title = `Connecting ${providerName(provider)}…`;
      popup.document.body.innerHTML = '<p style="font:15px -apple-system,system-ui,sans-serif;padding:24px;color:#525252">Preparing secure sign-in…</p>';
    } catch { /* cross-origin already */ }
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', listener);
      clearInterval(watcher);
      fn(value);
    };
    const listener = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'toolbox:mail-oauth-success') return;
      mailApi.activeAccountId = event.data.accountId || '';
      window.dispatchEvent(new CustomEvent('toolbox:mailconfigchange', { detail: { accountId: event.data.accountId } }));
      finish(resolve, event.data.accountId);
    };
    window.addEventListener('message', listener);
    const watcher = setInterval(() => { if (popup.closed) finish(reject, Object.assign(new Error('The sign-in window was closed.'), { cancelled: true })); }, 500);
    mailApi.oauthInit(provider, hint).then(data => { popup.location.replace(data.url); }).catch(err => { try { popup.close(); } catch { /* closed */ } finish(reject, err); });
  });
}

export function createMailSetupUI({ onboarding = false, onComplete = null, variant = 'panel' } = {}) {
  const container = document.createElement('div');
  container.className = `mls mls-${variant}`;
  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = `
      <div class="mls-card">
        <div class="mls-mark">${ICON_MAIL}</div>
        <h3 class="mls-title">Sign in to use Mail</h3>
        <p class="mls-text">Mailboxes are linked to your Toolbox account, so they stay private to you and follow you across devices.</p>
        <button type="button" class="btn btn-primary mls-cta" data-act="signin">Sign in to Toolbox</button>
      </div>`;
    container.querySelector('[data-act="signin"]').addEventListener('click', () => openAccountModal(false));
    return container;
  }

  const suggested = detectMailProvider(user.email);
  const order = suggested === 'microsoft' ? ['microsoft', 'google'] : ['google', 'microsoft'];
  const title = variant === 'hero' ? 'Bring your inbox to Toolbox' : onboarding ? 'A cleaner way to send and receive email' : 'Mail accounts';
  const text = variant === 'hero'
    ? 'Connect Gmail or Outlook to read, search and send mail here. You sign in with your provider; Toolbox never sees your password.'
    : onboarding ? 'Connect your mailbox now, or skip this step and add one later from Preferences.' : 'Connect Gmail and Microsoft accounts. Toolbox never stores your mailbox password.';

  container.innerHTML = `
    <div class="mls-card">
      <div class="mls-mark">${ICON_MAIL}</div>
      <h3 class="mls-title">${title}</h3>
      <p class="mls-text">${text}</p>
      <div class="mls-accounts" data-role="accounts" ${variant === 'hero' ? 'hidden' : ''}><span class="mls-muted">Checking connected accounts…</span></div>
      <div class="mls-providers">
        ${order.map(p => `
          <button type="button" class="mls-provider" data-provider="${p}">
            <span class="mls-provider-logo">${p === 'google' ? ICON_GOOGLE : ICON_MS}</span>
            <span class="mls-provider-text"><strong>Continue with ${providerName(p)}</strong><small>${p === 'google' ? 'Gmail and Google Workspace' : 'Outlook, Hotmail and Microsoft 365'}</small></span>
            ${p === suggested ? '<span class="mls-badge">Suggested</span>' : ''}
          </button>`).join('')}
      </div>
      <p class="mls-note">${ICON_LOCK}<span>Sign-in happens with ${providerName(order[0])} or ${providerName(order[1])} directly. Tokens are encrypted and you can disconnect at any time.</span></p>
      ${onboarding ? '<button type="button" class="mls-skip" data-act="skip">Not now</button>' : ''}
      <div class="mls-error" role="status" data-role="error"></div>
    </div>`;

  const list = container.querySelector('[data-role="accounts"]');
  const error = container.querySelector('[data-role="error"]');

  const renderAccounts = async () => {
    try {
      const data = await mailApi.status();
      const accounts = data.accounts || [];
      const activeId = mailApi.activeAccountId || data.activeAccountId;
      if (variant === 'hero') { list.hidden = !accounts.length; }
      if (!accounts.length) { list.innerHTML = '<span class="mls-muted">No mailbox connected yet.</span>'; return; }
      const active = accounts.find(a => a.id === activeId) ? activeId : accounts[0].id;
      list.innerHTML = accounts.map(a => `
        <div class="mls-account${a.id === active ? ' is-active' : ''}">
          <button type="button" class="mls-account-main" data-use="${esc(a.id)}" aria-pressed="${a.id === active}">
            <span class="mls-avatar">${esc((a.email || '?')[0].toUpperCase())}</span>
            <span class="mls-account-text"><strong>${esc(a.email)}</strong><small>${providerName(a.provider)}${a.id === active ? ' · In use' : ''}</small></span>
            ${a.id === active ? `<span class="mls-check">${ICON_CHECK}</span>` : ''}
          </button>
          <button type="button" class="mls-disconnect" data-disconnect="${esc(a.id)}">Disconnect</button>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = `<span class="mls-muted">${esc(err.message || 'Connected accounts could not be loaded.')}</span>`;
    }
  };
  void renderAccounts();

  list.addEventListener('click', async (e) => {
    const use = e.target.closest('[data-use]');
    const off = e.target.closest('[data-disconnect]');
    if (use) {
      mailApi.activeAccountId = use.dataset.use;
      window.dispatchEvent(new CustomEvent('toolbox:mailconfigchange', { detail: { accountId: use.dataset.use } }));
      void renderAccounts();
    } else if (off) {
      if (off.dataset.confirm !== '1') { off.dataset.confirm = '1'; off.textContent = 'Confirm'; off.classList.add('is-danger'); return; }
      off.disabled = true;
      try {
        await mailApi.disconnect(off.dataset.disconnect);
        if (mailApi.activeAccountId === off.dataset.disconnect) mailApi.activeAccountId = '';
        window.dispatchEvent(new CustomEvent('toolbox:mailconfigchange', { detail: { removed: off.dataset.disconnect } }));
      } catch (err) { error.textContent = err.message; }
      void renderAccounts();
    }
  });

  container.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', async () => {
    error.textContent = '';
    container.querySelectorAll('[data-provider]').forEach(b => { b.disabled = true; });
    button.classList.add('is-busy');
    try {
      await connectMailbox(button.dataset.provider);
      void renderAccounts();
      onComplete?.();
    } catch (err) {
      if (!err.cancelled) error.textContent = err.message;
    } finally {
      container.querySelectorAll('[data-provider]').forEach(b => { b.disabled = false; });
      button.classList.remove('is-busy');
    }
  }));
  container.querySelector('[data-act="skip"]')?.addEventListener('click', () => onComplete?.());
  return container;
}
