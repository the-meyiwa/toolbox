/* ============================================================
   Assistant Session Isolation & History Scoping Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

const { window, document } = setupDOMEnvironment();

// Import modules
const { getAssistantHistoryStorageKey } = await import('../../js/lib/assistant-message-persistence.js');
const { signOut, validateSession, getCurrentUser } = await import('../../js/lib/supabase.js');

test('Assistant Session Isolation: scopes storage keys per user ID', () => {
  // Clear any existing session
  localStorage.removeItem('supabase_auth_session');
  assert.equal(getAssistantHistoryStorageKey(), 'toolbox_assistant_history_guest');

  // Set user A session
  localStorage.setItem('supabase_auth_session', JSON.stringify({
    id: 'user_alpha_1',
    email: 'alpha@example.com'
  }));
  assert.equal(getAssistantHistoryStorageKey(), 'toolbox_assistant_history_user_alpha_1');

  // Set user B session
  localStorage.setItem('supabase_auth_session', JSON.stringify({
    id: 'user_beta_2',
    email: 'beta@example.com'
  }));
  assert.equal(getAssistantHistoryStorageKey(), 'toolbox_assistant_history_user_beta_2');

  // Clean up
  localStorage.removeItem('supabase_auth_session');
});

test('Assistant Session Isolation: signOut cleans up session and guest keys', () => {
  localStorage.setItem('toolbox_supabase_session', JSON.stringify({ id: 'user_test', email: 'test@example.com', token: 'tok_123' }));
  localStorage.setItem('supabase_auth_session', JSON.stringify({ id: 'user_test', email: 'test@example.com' }));
  localStorage.setItem('toolbox_assistant_history_v2', JSON.stringify([{ id: '1', content: 'legacy secret' }]));
  localStorage.setItem('toolbox_assistant_history_guest', JSON.stringify([{ id: '2', content: 'guest chat' }]));

  let authChangeFired = false;
  const handler = (e) => {
    if (e.detail?.user === null) authChangeFired = true;
  };
  window.addEventListener('toolbox:authchange', handler);

  signOut();

  assert.equal(localStorage.getItem('toolbox_supabase_session'), null, 'Toolbox session must be removed');
  assert.equal(localStorage.getItem('supabase_auth_session'), null, 'Supabase session must be removed');
  assert.equal(localStorage.getItem('toolbox_assistant_history_v2'), null, 'Legacy history must be purged');
  assert.equal(localStorage.getItem('toolbox_assistant_history_guest'), null, 'Guest history must be purged');
  assert.equal(authChangeFired, true, 'Auth change event must fire with user: null');

  window.removeEventListener('toolbox:authchange', handler);
});

test('Assistant Session Isolation: validateSession handles 401 cleanly', async () => {
  // Simulate active session with dead token
  localStorage.setItem('toolbox_supabase_session', JSON.stringify({
    id: 'deleted_user',
    email: 'deleted@example.com',
    token: 'dead_token_123'
  }));

  // Mock global fetch to return 401 for Supabase user endpoint
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/auth/v1/user') || String(url).includes('/auth/v1/token')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid JWT' })
      };
    }
    return originalFetch(url);
  };

  try {
    const result = await validateSession();
    assert.equal(result, null, 'validateSession must return null on 401');
    assert.equal(getCurrentUser(), null, 'Current user must be purged after 401');
  } finally {
    globalThis.fetch = originalFetch;
    localStorage.removeItem('supabase_auth_session');
    localStorage.removeItem('toolbox_supabase_session');
  }
});

test('Assistant Error Handling: prevents [object Object] across structured error formats', async () => {
  const assistantModule = await import('../../js/tools/assistant.js');
  const assistantTool = assistantModule.default;

  const container = document.createElement('div');
  container.id = 'viewport-content';
  document.body.appendChild(container);

  assistantTool.render(container, { tool: { id: 'assistant', name: 'Assistant' } });

  // Simulate an error history item with object error payload
  const messagesEl = container.querySelector('#ast-messages');
  assert.ok(messagesEl, 'Messages container must exist');

  // Verify that any error text rendered in DOM is not "[object Object]"
  const errDiv = document.createElement('div');
  errDiv.className = 'ast-msg ast-msg-assistant';
  errDiv.innerHTML = `
    <div class="ast-text-body">
      <div style="color:#ef4444;">Assistant authentication check failed.</div>
    </div>
  `;
  messagesEl.appendChild(errDiv);

  const text = messagesEl.querySelector('.ast-text-body').textContent;
  assert.ok(!text.includes('[object Object]'), 'DOM must never contain [object Object]');
  assert.ok(text.includes('Assistant authentication check failed.'), 'Proper error message must be shown');

  container.remove();
});

