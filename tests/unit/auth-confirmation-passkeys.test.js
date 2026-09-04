/* ============================================================
   Email Confirmation & WebAuthn Passkeys Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

const { window, document } = setupDOMEnvironment();

if (!window.location) {
  window.location = {
    hash: '',
    search: '',
    origin: 'http://localhost:5173',
    pathname: '/',
    hostname: 'localhost'
  };
}

const {
  parseAuthRedirect,
  resendConfirmationEmail,
  isPasskeySupported,
  getRegisteredPasskeys,
  registerPasskey,
  removeRegisteredPasskey,
  authenticateWithPasskey,
  signOut
} = await import('../../js/lib/supabase.js');

const { openAccountModal, closeAccountModal } = await import('../../js/views/account-modal.js');

test('parseAuthRedirect: detects email signup confirmation redirect with tokens', () => {
  window.location.hash = '#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5ld3VzZXJAZXhhbXBsZS5jb20iLCJzdWIiOiJ1c3JfMTIzIn0.sig&refresh_token=ref_signup_1&expires_in=3600&token_type=bearer&type=signup';
  window.location.search = '';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'signup');
  assert.equal(redirect.accessToken, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5ld3VzZXJAZXhhbXBsZS5jb20iLCJzdWIiOiJ1c3JfMTIzIn0.sig');
  assert.equal(redirect.refreshToken, 'ref_signup_1');
  assert.equal(redirect.email, 'newuser@example.com');
  assert.equal(redirect.userId, 'usr_123');
});

test('parseAuthRedirect: detects email_change verification redirect', () => {
  window.location.hash = '#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVwZGF0ZWRAZXhhbXBsZS5jb20iLCJzdWIiOiJ1c3JfNDU2In0.sig&refresh_token=ref_email_change&type=email_change';
  window.location.search = '';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'email_change');
  assert.equal(redirect.email, 'updated@example.com');
  assert.equal(redirect.userId, 'usr_456');
});

test('parseAuthRedirect: detects invite confirmation redirect', () => {
  window.location.hash = '#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imludml0ZWVAZXhhbXBsZS5jb20ifQ.sig&refresh_token=ref_invite&type=invite';
  window.location.search = '';

  const redirect = parseAuthRedirect();
  assert.ok(redirect);
  assert.equal(redirect.type, 'invite');
  assert.equal(redirect.email, 'invitee@example.com');
});

test('resendConfirmationEmail: validates email address and dispatches to resend endpoint', async () => {
  const emptyRes = await resendConfirmationEmail('');
  assert.equal(emptyRes.success, false);
  assert.ok(emptyRes.error.includes('email address'));

  const originalFetch = globalThis.fetch;
  let requestedEndpoint = '';
  let requestedBody = null;

  globalThis.fetch = async (url, opts) => {
    requestedEndpoint = url;
    requestedBody = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({})
    };
  };

  try {
    const res = await resendConfirmationEmail('test@resend.dev');
    assert.equal(res.success, true);
    assert.ok(requestedEndpoint.includes('/auth/v1/resend'));
    assert.equal(requestedBody.type, 'signup');
    assert.equal(requestedBody.email, 'test@resend.dev');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Passkeys: detection and credentials lifecycle', async () => {
  // Mock PublicKeyCredential and navigator.credentials in DOM environment
  const originalCredentials = navigator.credentials;
  const originalPKC = window.PublicKeyCredential;

  const mockCredId = 'pk_credential_abc123';
  window.PublicKeyCredential = class PublicKeyCredential {
    static async isUserVerifyingPlatformAuthenticatorAvailable() {
      return true;
    }
  };

  navigator.credentials = {
    create: async (opts) => {
      assert.ok(opts.publicKey);
      assert.equal(opts.publicKey.rp.name, 'Toolbox');
      return {
        id: mockCredId,
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        response: {
          getTransports: () => ['internal']
        }
      };
    },
    get: async (opts) => {
      assert.ok(opts.publicKey);
      return {
        id: mockCredId,
        rawId: new Uint8Array([1, 2, 3, 4]).buffer
      };
    }
  };

  try {
    assert.equal(isPasskeySupported(), true);

    const mockUser = {
      id: 'usr_passkey_test',
      email: 'passkey.user@toolbox.app',
      token: 'tok_active_123'
    };

    // Register passkey
    const regRes = await registerPasskey(mockUser, 'Test MacBook Touch ID');
    assert.equal(regRes.success, true);
    assert.equal(regRes.passkey.id, mockCredId);
    assert.equal(regRes.passkey.name, 'Test MacBook Touch ID');

    // List registered passkeys
    const passkeys = getRegisteredPasskeys(mockUser);
    assert.ok(passkeys.length >= 1);
    assert.equal(passkeys[passkeys.length - 1].id, mockCredId);

    // Authenticate with passkey
    const authRes = await authenticateWithPasskey('passkey.user@toolbox.app');
    assert.equal(authRes.success, true);
    assert.equal(authRes.user.email, 'passkey.user@toolbox.app');
    assert.equal(authRes.user.authProvider, 'passkey');

    // Remove passkey
    const removeRes = await removeRegisteredPasskey(mockUser, mockCredId);
    assert.equal(removeRes.success, true);
    const updatedPasskeys = getRegisteredPasskeys(mockUser);
    assert.equal(updatedPasskeys.some(k => k.id === mockCredId), false);
  } finally {
    navigator.credentials = originalCredentials;
    window.PublicKeyCredential = originalPKC;
  }
});

test('Account Modal: renders verification pending state and passkey options', async () => {
  signOut();

  // Test verify-pending view
  await openAccountModal('verify-pending');
  const modal = document.getElementById('account-modal');
  assert.ok(modal);
  assert.ok(modal.innerHTML.includes('Check Your Inbox'));
  assert.ok(modal.querySelector('#btn-resend-confirmation'));
  assert.ok(modal.querySelector('#btn-pending-back'));

  // Test signin view with passkey button
  window.PublicKeyCredential = class {};
  navigator.credentials = { create: async () => {}, get: async () => {} };

  await openAccountModal('signin');
  assert.ok(modal.innerHTML.includes('Continue with Passkey'));
  assert.ok(modal.querySelector('#btn-auth-passkey'));
  assert.ok(modal.querySelector('#auth-email-input').getAttribute('autocomplete').includes('webauthn'));

  closeAccountModal();
  assert.equal(modal.style.display, 'none');
});
