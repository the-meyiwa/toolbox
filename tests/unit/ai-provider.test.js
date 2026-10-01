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
  getAssistantMemory,
  clearAssistantMemory,
  streamChatCompletion,
  testAiProviderConnection
} from '../../js/lib/ai-provider.js';
import { QuotaManager } from '../../js/lib/quota-manager.js';
import { addMindSource, readMind, upsertMindEntity } from '../../js/lib/mind-store.js';

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

test('AI Provider: clearing Assistant memory preserves user-created Mind memories', () => {
  localStorage.clear();
  localStorage.setItem('toolbox_mind_v1:memory-migrated', '1');
  const manual = upsertMindEntity({ type: 'Memory', name: 'Family story', content: 'A memory added in Mind' });
  const source = addMindSource({ kind: 'assistant' });
  upsertMindEntity({ id: manual.id, name: manual.name, type: 'Memory', sourceIds: [source.id] });
  const assistant = upsertMindEntity({ type: 'Memory', name: 'Assistant fact', content: 'A remembered preference', sourceIds: [source.id], properties: { origin: 'assistant' } });
  assert.deepEqual(getAssistantMemory().map(f => f.id), [assistant.id]);
  clearAssistantMemory();
  assert.ok(readMind().entities.some(e => e.id === manual.id));
  assert.ok(!readMind().entities.some(e => e.id === assistant.id));
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

test('QuotaManager: browser storage cannot grant unlimited access; verified server quota can', async () => {
  localStorage.clear();
  localStorage.setItem('toolbox_user_email', 'meyigbenee@gmail.com');
  localStorage.setItem('toolbox_supabase_session', JSON.stringify({ id: 'quota-user', email: 'meyigbenee@gmail.com', token: 'valid-token' }));
  assert.equal(QuotaManager.isUserUnlimited(), false);
  assert.equal(QuotaManager.getQuotaSummary().messagesLimit, QuotaManager.LIMITS.DAILY_MESSAGES);
  assert.throws(() => QuotaManager.resetQuotas(), /managed by the server/);
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, '/api/assistant/v2/quota');
    return new Response(JSON.stringify({ isUnlimited: true, messagesUsed: 2, messagesRemaining: null, burstRemaining: null }), { status: 200 });
  };
  try {
    await QuotaManager.refreshServerQuota({ force: true });
    assert.equal(QuotaManager.isUserUnlimited(), true);
    assert.equal(QuotaManager.getQuotaSummary().messagesLimit, 'Unlimited');
  } finally {
    globalThis.fetch = original;
    localStorage.removeItem('toolbox_supabase_session');
    localStorage.removeItem('toolbox_user_email');
  }
});
