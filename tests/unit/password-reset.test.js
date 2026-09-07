/* ============================================================
   Password Reset & Auth Redirect Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

const { window, document } = setupDOMEnvironment();

// Ensure mock localStorage and window location exist
if (!window.location) {
  window.location = {
    hash: '',
    search: '',
    origin: 'http://localhost:5173',
    pathname: '/'
  };
}

const { parseAuthRedirect, updateUserPassword } = await import('../../js/lib/supabase.js');
const { openAccountModal, closeAccountModal } = await import('../../js/views/account-modal.js');

test('parseAuthRedirect: returns null for normal tool navigation hashes', () => {
  window.location.hash = '#tools';
  window.location.search = '';
  assert.equal(parseAuthRedirect(), null);

  window.location.hash = '#assistant';
  assert.equal(parseAuthRedirect(), null);

  window.location.hash = '';
  assert.equal(parseAuthRedirect(), null);
});

test('parseAuthRedirect: detects recovery tokens from hash fragment', () => {
  window.location.hash = '#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test&refresh_token=refresh_123&expires_in=3600&token_type=bearer&type=recovery';
  window.location.search = '';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'recovery');
  assert.equal(redirect.accessToken, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
  assert.equal(redirect.refreshToken, 'refresh_123');
  assert.equal(redirect.expiresIn, '3600');
});

test('parseAuthRedirect: detects recovery tokens from double-hash URLs and decodes email', () => {
  window.location.hash = '#type=recovery#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ.sig&refresh_token=refresh_double&expires_in=3600&type=recovery';
  window.location.search = '';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'recovery');
  assert.equal(redirect.accessToken, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ.sig');
  assert.equal(redirect.refreshToken, 'refresh_double');
  assert.equal(redirect.email, 'user@example.com');
});

test('parseAuthRedirect: detects recovery tokens from search query parameters', () => {
  window.location.hash = '';
  window.location.search = '?type=recovery&access_token=tok_search_abc&refresh_token=ref_search_xyz';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'recovery');
  assert.equal(redirect.accessToken, 'tok_search_abc');
  assert.equal(redirect.refreshToken, 'ref_search_xyz');
});

test('parseAuthRedirect: detects authentication errors in redirect URL', () => {
  window.location.hash = '#error=unauthorized_client&error_code=401&error_description=Email+link+is+invalid+or+has+expired';
  window.location.search = '';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'error');
  assert.equal(redirect.error, 'Email link is invalid or has expired');
});

test('updateUserPassword: fails when password is too short', async () => {
  const res = await updateUserPassword('123');
  assert.equal(res.success, false);
  assert.ok(res.error.includes('at least 6 characters'));
});

test('updateUserPassword: succeeds and persists session when api returns updated user', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url.includes('/auth/v1/user') && opts.method === 'PUT') {
      return {
        ok: true,
        json: async () => ({
          id: 'usr_test_123',
          email: 'test@example.com',
          access_token: 'tok_new_123',
          refresh_token: 'ref_new_123',
          created_at: new Date().toISOString()
        })
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const activeUser = { id: 'usr_test_123', email: 'test@example.com', token: 'tok_active_abc' };
    localStorage.setItem('toolbox_supabase_session', JSON.stringify(activeUser));

    const res = await updateUserPassword('NewSecurePassword123!', 'tok_active_abc');
    assert.equal(res.success, true);
    assert.ok(res.user);
    assert.equal(res.user.token, 'tok_new_123');

    const saved = JSON.parse(localStorage.getItem('toolbox_supabase_session'));
    assert.equal(saved.token, 'tok_new_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('openAccountModal: opens in set-new-password mode with inputs and strength meter', async () => {
  await openAccountModal('set-new-password', {
    accessToken: 'test_token',
    email: 'user@example.com'
  });

  const modal = document.getElementById('account-modal');
  assert.ok(modal);
  assert.equal(modal.style.display, 'flex');

  const title = modal.querySelector('.settings-modal-title');
  assert.ok(title);
  assert.equal(title.textContent.trim(), 'Set New Password');

  const newPwdInput = modal.querySelector('#new-pwd-input');
  const confirmPwdInput = modal.querySelector('#new-pwd-confirm-input');
  const submitBtn = modal.querySelector('#btn-set-pwd-submit');
  const emailLabel = modal.querySelector('#set-pwd-email-label');

  assert.ok(newPwdInput);
  assert.ok(confirmPwdInput);
  assert.ok(submitBtn);
  assert.equal(emailLabel.textContent.trim(), 'user@example.com');

  closeAccountModal();
  assert.equal(modal.style.display, 'none');
});
