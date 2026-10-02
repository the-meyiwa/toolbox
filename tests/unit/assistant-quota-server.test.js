import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_QUOTA_LIMITS, createMemoryAssistantQuotaStore } from '../../server-assistant-quota.js';
const store = createMemoryAssistantQuotaStore();
const { summary: assistantQuotaSummary, reserve: reserveAssistantTurn, release: releaseAssistantTurn, commit: commitAssistantTurn, clear: clearAssistantQuotaForTests } = store;

const user = { id: 'ordinary-user', email: 'ordinary@example.com' };
const prompt = (turnId, content = 'Please help with this') => ({ turnId, messages: [{ role: 'user', content }] });
const base = Date.parse('2026-10-01T12:00:00Z');

test('Assistant quota counts a multi-step task once, but a new prompt with a reused turn id costs another message', () => {
  clearAssistantQuotaForTests();
  const first = reserveAssistantTurn(user, prompt('turn_complex_1'), base);
  assert.equal(first.allowed, true);
  assert.equal(first.charged, true);
  for (let step = 1; step < 16; step++) {
    const again = reserveAssistantTurn(user, prompt('turn_complex_1'), base + step);
    assert.equal(again.allowed, true);
    assert.equal(again.charged, false);
    commitAssistantTurn(user, again, base + step);
  }
  assert.equal(assistantQuotaSummary(user, base + 20).messagesUsed, 1);
  assert.equal(reserveAssistantTurn(user, prompt('turn_complex_1', 'Different request'), base + 21).charged, true);
  assert.equal(assistantQuotaSummary(user, base + 21).messagesUsed, 2);
});

test('Assistant quota enforces burst and daily limits by verified user identity', () => {
  clearAssistantQuotaForTests();
  for (let i = 0; i < ASSISTANT_QUOTA_LIMITS.burst; i++) {
    assert.equal(reserveAssistantTurn(user, prompt(`turn_burst_${i}`), base + i).allowed, true);
  }
  const burst = reserveAssistantTurn(user, prompt('turn_burst_blocked'), base + 100);
  assert.equal(burst.status, 429);
  assert.ok(burst.retryAfter > 0);
  for (let i = ASSISTANT_QUOTA_LIMITS.burst; i < ASSISTANT_QUOTA_LIMITS.daily; i++) {
    const receipt = reserveAssistantTurn(user, prompt(`turn_daily_${i}`), base + i * 61_000);
    assert.equal(receipt.allowed, true);
    commitAssistantTurn(user, receipt, base + i * 61_000);
  }
  // Previous loop crosses midnight; check daily separately at a fixed day with spaced timestamps.
  clearAssistantQuotaForTests();
  for (let i = 0; i < ASSISTANT_QUOTA_LIMITS.daily; i++) {
    const at = base + i * 61_000;
    const receipt = reserveAssistantTurn(user, prompt(`turn_limit_${i}`), at);
    assert.equal(receipt.allowed, true);
    commitAssistantTurn(user, receipt, at);
  }
  const n = ASSISTANT_QUOTA_LIMITS.daily;
  assert.equal(assistantQuotaSummary(user, base + (n - 1) * 61_000).messagesUsed, n);
  assert.equal(reserveAssistantTurn(user, prompt('turn_limit_extra'), base + n * 61_000).status, 429);
});

test('Provider failure refunds the reserved message and a verified owner has unlimited access', () => {
  clearAssistantQuotaForTests();
  const held = reserveAssistantTurn(user, prompt('turn_failed_1'), base);
  releaseAssistantTurn(user, held, base + 1);
  assert.equal(assistantQuotaSummary(user, base + 2).messagesUsed, 0);
  releaseAssistantTurn(user, held, base + 2);
  assert.equal(assistantQuotaSummary(user, base + 2).requestsUsed, 1);
  assert.equal(reserveAssistantTurn(user, prompt('turn_failed_1'), base + 3).charged, true);
  const owner = { id: 'verified-owner', email: 'meyigbenee@gmail.com' };
  for (let i = 0; i < 65; i++) assert.equal(reserveAssistantTurn(owner, prompt(`turn_owner_${i}`), base + i).allowed, true);
  assert.equal(assistantQuotaSummary(owner, base + 70).isUnlimited, true);
});

test('A single turn cannot run indefinitely under one quota charge', () => {
  clearAssistantQuotaForTests();
  for (let i = 0; i < ASSISTANT_QUOTA_LIMITS.maxStepsPerTurn; i++) {
    assert.equal(reserveAssistantTurn(user, prompt('turn_steps_1'), base + i).allowed, true);
  }
  assert.equal(reserveAssistantTurn(user, prompt('turn_steps_1'), base + 100).status, 429);
});

test('The owner can run one task for as many steps as it needs', () => {
  clearAssistantQuotaForTests();
  const owner = { id: 'verified-owner', email: 'meyigbenee@icloud.com' };
  for (let i = 0; i < ASSISTANT_QUOTA_LIMITS.maxStepsPerTurn * 3; i++) {
    assert.equal(reserveAssistantTurn(owner, prompt('turn_owner_long'), base + i * 2000).allowed, true);
  }
});

test('Many model steps still have an account-wide work budget', () => {
  clearAssistantQuotaForTests();
  for (let i = 0; i < ASSISTANT_QUOTA_LIMITS.requestsDaily; i++) {
    const turnId = `turn_work_${Math.floor(i / ASSISTANT_QUOTA_LIMITS.maxStepsPerTurn)}`;
    const receipt = reserveAssistantTurn(user, prompt(turnId), base + i * 3100);
    assert.equal(receipt.allowed, true);
    commitAssistantTurn(user, receipt, base + i * 3100);
  }
  assert.equal(reserveAssistantTurn(user, prompt('turn_work_extra'), base + ASSISTANT_QUOTA_LIMITS.requestsDaily * 3100).status, 429);
});
