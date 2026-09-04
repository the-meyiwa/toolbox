/* ============================================================
   AI Provider & Online Google Gemini API Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_MODES,
  getActiveAiMode,
  setActiveAiMode,
  getGeminiApiKey,
  setGeminiApiKey,
  streamChatCompletion,
  testAiProviderConnection
} from '../../js/lib/ai-provider.js';
import { QuotaManager } from '../../js/lib/quota-manager.js';

// Polyfill localStorage and window for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } }
  };
}

test('AI Provider: AI_MODES contains essential Gemini reasoning modes', () => {
  const expected = ['auto', 'reasoning', 'code', 'science', 'files'];
  for (const exp of expected) {
    assert.ok(AI_MODES[exp], `Mode ${exp} missing from config`);
    assert.ok(AI_MODES[exp].name, `Mode ${exp} missing name`);
    assert.ok(AI_MODES[exp].model, `Mode ${exp} missing model name`);
  }
});

test('AI Provider: mode getters and setters work properly', () => {
  setActiveAiMode('code');
  assert.equal(getActiveAiMode(), 'code');

  setActiveAiMode('auto');
  assert.equal(getActiveAiMode(), 'auto');
});

test('AI Provider: API key getter and setter persist key', () => {
  setGeminiApiKey('AIzaSyTestKey12345');
  assert.equal(getGeminiApiKey(), 'AIzaSyTestKey12345');

  setGeminiApiKey('');
  assert.equal(getGeminiApiKey(), '');
});

test('AI Provider: streamChatCompletion handles tokens in test mock environment', async () => {
  const tokens = [];
  const res = await streamChatCompletion({
    history: [{ role: 'user', content: 'What is 2 + 2?' }],
    onToken: (t) => tokens.push(t)
  });

  assert.ok(tokens.length > 0, 'Expected tokens to be streamed');
  assert.ok(res.text.length > 0, 'Expected non-empty response text');
});

test('AI Provider: testAiProviderConnection validates key requirements', async () => {
  const missingRes = await testAiProviderConnection('gemini', '');
  assert.equal(missingRes.success, false);
});

test('QuotaManager: unlimited accounts verification and quota rules', () => {
  // 1. Direct email verification
  assert.equal(QuotaManager.isUserUnlimited('meyigbenee@gmail.com'), true);
  assert.equal(QuotaManager.isUserUnlimited('meyigbenee@icloud.com'), true);
  assert.equal(QuotaManager.isUserUnlimited('MEYIGBENEE@GMAIL.COM'), true);
  assert.equal(QuotaManager.isUserUnlimited('guest@example.com'), false);
  assert.equal(QuotaManager.isUserUnlimited('randomuser@gmail.com'), false);

  // 2. Free tier behavior (no unlimited email set)
  localStorage.removeItem('toolbox_user_email');
  localStorage.removeItem('toolbox_supabase_session');
  localStorage.removeItem('supabase_auth_session');
  
  assert.equal(QuotaManager.isUserUnlimited(), false);
  const freeSummary = QuotaManager.getQuotaSummary();
  assert.equal(freeSummary.isUnlimited, false);
  assert.equal(freeSummary.messagesLimit, QuotaManager.LIMITS.DAILY_MESSAGES);
  assert.throws(() => {
    QuotaManager.resetQuotas();
  }, /Permission denied/);

  // 3. Unlimited tier behavior (logged in with meyigbenee@gmail.com)
  localStorage.setItem('toolbox_user_email', 'meyigbenee@gmail.com');
  assert.equal(QuotaManager.isUserUnlimited(), true);
  const unlimitedSummary = QuotaManager.getQuotaSummary();
  assert.equal(unlimitedSummary.isUnlimited, true);
  assert.equal(unlimitedSummary.messagesLimit, 'Unlimited');

  QuotaManager.recordMessage();
  QuotaManager.recordHeavyTask();
  let q = QuotaManager.getQuotaSummary();
  assert.ok(q.messagesUsed >= 1);
  assert.ok(q.heavyTasksUsed >= 1);

  QuotaManager.resetQuotas();
  q = QuotaManager.getQuotaSummary();
  assert.equal(q.messagesUsed, 0);
  assert.equal(q.heavyTasksUsed, 0);
  assert.equal(q.messagesRemaining, 'Unlimited');

  // Clean up
  localStorage.removeItem('toolbox_user_email');
});
