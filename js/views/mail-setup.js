import { getCurrentUser } from '../lib/supabase.js';
import { openAccountModal } from './account-modal.js';

export function detectMailProvider(email = '') {
  const domain = String(email).toLowerCase().split('@')[1] || '';
  if (/(outlook|hotmail|live|msn|microsoft|office365)/.test(domain)) return 'microsoft';
  return 'google';
}

const providerName = provider => provider === 'microsoft' ? 'Microsoft' : 'Google';

export function createMailSetupUI({ onboarding = false, onComplete = null } = {}) {
  const container = document.createElement('div');
  container.className = 'mail-setup-container';
  const user = getCurrentUser();
  if (!user) {
    container.innerHTML = `<div class="mail-setup-card"><div class="mail-setup-icon"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></div><h3>Sign in to connect Mail</h3><p>Mail accounts are linked to your Toolbox profile so they stay private and available across your sessions.</p><button type="button" class="btn btn-primary" id="mail-setup-signin">Sign in to Toolbox</button></div>`;
    container.querySelector('#mail-setup-signin')?.addEventListener('click', () => openAccountModal(false));
    return container;
  }

  const suggestedProvider = detectMailProvider(user.email);
  container.innerHTML = `<div class="mail-setup-card"><div class="mail-setup-icon"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></div><h3>${onboarding ? 'A cleaner way to send and receive emails' : 'Mail accounts'}</h3><p>${onboarding ? 'Connect your mailbox now, or skip this optional step and return from Preferences at any time.' : 'Connect Gmail and Microsoft accounts with OAuth. Toolbox never stores your mailbox password.'}</p><div id="mail-account-list" class="mail-account-list"><span class="mail-setup-muted">Checking connected accounts…</span></div><div class="mail-provider-actions"><button type="button" class="btn ${suggestedProvider === 'google' ? 'btn-primary' : 'btn-secondary'}" data-mail-provider="google">Connect Google</button><button type="button" class="btn ${suggestedProvider === 'microsoft' ? 'btn-primary' : 'btn-secondary'}" data-mail-provider="microsoft">Connect Microsoft</button></div><div class="mail-provider-hint">Suggested for ${user.email}: <strong>${providerName(suggestedProvider)}</strong></div>${onboarding ? '<button type="button" class="mail-setup-skip" id="mail-setup-skip">Not now</button>' : ''}<div id="oauth-error-container" class="mail-setup-error" role="status"></div></div>`;

  const list = container.querySelector('#mail-account-list');
  const error = container.querySelector('#oauth-error-container');
  const authHeaders = () => ({ Authorization: `Bearer ${user.token}` });
  const renderAccounts = async () => {
    try {
      const response = await fetch('/api/mail/status', { headers: authHeaders() });
      const data = await response.json();
      const accounts = data.accounts || [];
      const activeId = localStorage.getItem('toolbox_mail_active_account') || data.activeAccountId;
      list.innerHTML = accounts.length ? accounts.map((account, index) => `<label class="mail-account-row"><input type="radio" name="mail-active-account" value="${account.id}" ${account.id === activeId || (!activeId && index === 0) ? 'checked' : ''}><span><strong>${account.email}</strong><small>${providerName(account.provider)}</small></span></label>`).join('') : '<span class="mail-setup-muted">No mailbox connected yet.</span>';
      list.querySelectorAll('input[name="mail-active-account"]').forEach(input => input.addEventListener('change', () => { localStorage.setItem('toolbox_mail_active_account', input.value); window.dispatchEvent(new CustomEvent('toolbox:mailconfigchange')); }));
    } catch { list.innerHTML = '<span class="mail-setup-muted">Connected accounts could not be loaded.</span>'; }
  };
  void renderAccounts();

  container.querySelectorAll('[data-mail-provider]').forEach(button => button.addEventListener('click', async () => {
    const provider = button.dataset.mailProvider;
    const popup = window.open('about:blank', `Toolbox ${providerName(provider)} Mail`, 'width=520,height=680');
    if (!popup) {
      error.textContent = 'Allow popups for Toolbox to connect your mailbox.';
      return;
    }
    popup.document.title = `Connecting ${providerName(provider)} Mail…`;
    popup.document.body.innerHTML = '<p style="font:15px system-ui;padding:24px">Preparing secure mailbox authorization…</p>';
    button.disabled = true;
    error.textContent = '';
    try {
      const response = await fetch(`/api/mail/oauth/init?provider=${provider}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not start mailbox authorization.');
      popup.location.replace(data.url);
      const listener = event => {
        if (event.origin !== window.location.origin || event.data?.type !== 'toolbox:mail-oauth-success') return;
        window.removeEventListener('message', listener);
        clearInterval(closeWatcher);
        button.disabled = false;
        localStorage.setItem('toolbox_mail_active_account', event.data.accountId || '');
        window.dispatchEvent(new CustomEvent('toolbox:mailconfigchange'));
        void renderAccounts();
        onComplete?.();
      };
      window.addEventListener('message', listener);
      const closeWatcher = window.setInterval(() => {
        if (!popup.closed) return;
        clearInterval(closeWatcher);
        window.removeEventListener('message', listener);
        button.disabled = false;
      }, 400);
    } catch (err) { popup.close(); error.textContent = err.message; button.disabled = false; }
  }));
  container.querySelector('#mail-setup-skip')?.addEventListener('click', () => onComplete?.());
  return container;
}
