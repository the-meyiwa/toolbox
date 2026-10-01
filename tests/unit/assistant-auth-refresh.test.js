import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { refreshUserSession, getCurrentUser, signInWithEmail, signUpWithEmail } = await import('../../js/lib/supabase.js');
const { openGateway } = await import('../../js/lib/model-gateway.js');
const session = (token = 'old-token') => ({ id: 'u1', email: 'user@example.com', token, refreshToken: 'refresh-token' });

test('Expired Assistant token refreshes once and the retry uses the new token', async () => {
  localStorage.setItem('toolbox_supabase_session', JSON.stringify(session()));
  const original = globalThis.fetch;
  const headers = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/token')) return new Response(JSON.stringify({ access_token: 'new-token', refresh_token: 'new-refresh', user: { id: 'u1', email: 'user@example.com' } }), { status: 200 });
    assert.equal(url, '/api/assistant/v2/chat');
    headers.push(options.headers.Authorization);
    if (headers.length === 1) return new Response(JSON.stringify({ error: 'Expired' }), { status: 401, headers: { 'content-type': 'application/json' } });
    return new Response('data: {"choices":[{"delta":{"content":"okay"}}]}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    const result = await openGateway({ messages: [{ role: 'user', content: 'Hello' }] });
    assert.equal(result.status, 200);
    assert.deepEqual(headers, ['Bearer old-token', 'Bearer new-token']);
    assert.equal(getCurrentUser().token, 'new-token');
  } finally { globalThis.fetch = original; localStorage.clear(); }
});

test('Rejected refresh token signs out instead of recycling a revoked session', async () => {
  localStorage.setItem('toolbox_supabase_session', JSON.stringify(session()));
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    assert.equal(await refreshUserSession(), null);
    assert.equal(getCurrentUser(), null);
  } finally { globalThis.fetch = original; localStorage.clear(); }
});

test('Concurrent refresh attempts share one request when tokens rotate', async () => {
  localStorage.setItem('toolbox_supabase_session', JSON.stringify(session()));
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return new Response(JSON.stringify({ access_token: 'rotated-token', refresh_token: 'rotated-refresh', user: { id: 'u1', email: 'user@example.com' } }), { status: 200 });
  };
  try {
    const [a, b] = await Promise.all([refreshUserSession(), refreshUserSession()]);
    assert.equal(calls, 1);
    assert.equal(a.token, 'rotated-token');
    assert.equal(b.token, 'rotated-token');
  } finally { globalThis.fetch = original; localStorage.clear(); }
});

test('A refresh rejected after another tab rotated the token keeps the newer session', async () => {
  localStorage.setItem('toolbox_supabase_session', JSON.stringify(session()));
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    localStorage.setItem('toolbox_supabase_session', JSON.stringify({ ...session('newer-token'), refreshToken: 'newer-refresh' }));
    return new Response('{}', { status: 401 });
  };
  try {
    const result = await refreshUserSession();
    assert.equal(result.token, 'newer-token');
    assert.equal(getCurrentUser().token, 'newer-token');
  } finally { globalThis.fetch = original; localStorage.clear(); }
});

test('A stale refresh response never signs out a different account that just signed in', async () => {
  localStorage.setItem('toolbox_supabase_session', JSON.stringify(session()));
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    localStorage.setItem('toolbox_supabase_session', JSON.stringify({ id: 'u2', email: 'other@example.com', token: 'other-token', refreshToken: 'other-refresh' }));
    return new Response('{}', { status: 401 });
  };
  try {
    assert.equal((await refreshUserSession()).id, 'u2');
    assert.equal(getCurrentUser().id, 'u2');
  } finally { globalThis.fetch = original; localStorage.clear(); }
});

test('Sign-in only accepts a complete identity from the auth provider', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'token-without-user' }), { status: 200 });
  try {
    const result = await signInWithEmail('meyigbenee@gmail.com', 'password');
    assert.equal(result.success, false);
    assert.match(result.error, /incomplete/);
    assert.equal(getCurrentUser(), null);
  } finally { globalThis.fetch = original; localStorage.clear(); }
});

test('Instant sign-up does not invent an account identity from an incomplete response', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'token-without-user' }), { status: 200 });
  try {
    const result = await signUpWithEmail('meyigbenee@gmail.com', 'password');
    assert.equal(result.success, false);
    assert.match(result.error, /incomplete/);
    assert.equal(getCurrentUser(), null);
  } finally { globalThis.fetch = original; localStorage.clear(); }
});
