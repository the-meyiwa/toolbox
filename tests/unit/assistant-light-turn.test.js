import test from 'node:test';
import assert from 'node:assert/strict';
import { isLightPrompt } from '../../js/lib/assistant/light-turn.js';

for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']) delete process.env[key];
process.env.TOOLBOX_LOCAL_DEV_USER = '1';
const { reserveAssistantTurn, assistantQuotaSummary, clearAssistantQuotaForTests, ASSISTANT_QUOTA_LIMITS } = await import('../../server-assistant-quota.js');

test('small talk is light; anything that asks for work is not', () => {
  for (const t of ['hello', 'Hi there!', 'how are you?', 'thanks so much', 'good morning :)', 'who are you?']) assert.equal(isLightPrompt(t), true, t);
  for (const t of ['what is 2+2', 'hello, can you compress my photo', 'summarise this', 'hi '.repeat(30), '', null]) assert.equal(isLightPrompt(t), false, String(t));
});

test('light turns use their own allowance, not daily messages', () => {
  clearAssistantQuotaForTests();
  const user = { id: 'local-development', email: '' };
  const base = Date.parse('2026-10-01T12:00:00Z');
  for (let i = 0; i < 5; i++) {
    const r = reserveAssistantTurn(user, { light: true, turnId: `turn_light_${i}`, messages: [{ role: 'user', content: 'hello' }] }, base + i * 4000);
    assert.equal(r.allowed, true);
    assert.equal(r.charged, false);
  }
  const s = assistantQuotaSummary(user, base + 30_000);
  assert.equal(s.messagesUsed, 0);
  assert.equal(s.lightRemaining, ASSISTANT_QUOTA_LIMITS.lightDaily - 5);
});
