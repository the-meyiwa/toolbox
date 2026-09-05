import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { hydrateUserSessionFromAccessToken } from '../../js/lib/supabase.js';

setupDOMEnvironment();

test('hydrateUserSessionFromAccessToken: returns hydrated user data from Supabase', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        id: 'user-123',
        email: 'person@example.com',
        created_at: '2026-09-05T00:00:00.000Z',
        user_metadata: {
          username: 'person_name',
          display_name: 'Person Name'
        }
      };
    }
  });

  try {
    const session = await hydrateUserSessionFromAccessToken('tok', 'ref', 'fallback@example.com');
    assert.equal(session.id, 'user-123');
    assert.equal(session.email, 'person@example.com');
    assert.equal(session.username, 'person_name');
    assert.equal(session.displayName, 'Person Name');
    assert.equal(session.token, 'tok');
    assert.equal(session.refreshToken, 'ref');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('hydrateUserSessionFromAccessToken: falls back to derived local session on fetch failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network error');
  };

  try {
    const session = await hydrateUserSessionFromAccessToken('tok', '', 'fallback@example.com');
    assert.equal(session.email, 'fallback@example.com');
    assert.equal(session.username, 'fallback');
    assert.equal(session.displayName, 'fallback');
    assert.equal(session.token, 'tok');
    assert.ok(session.id.startsWith('usr_'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
