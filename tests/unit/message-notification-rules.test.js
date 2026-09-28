import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { unseenMessages } = await import('../../js/lib/message-notifications.js');

const at = (min) => new Date(Date.UTC(2026, 0, 1, 12, min)).toISOString();
const now = Date.parse(at(30));
const msg = (id, from, min) => ({ id, sender_id: from, created_at: at(min) });

test('Message notifications: only unseen messages from others notify', () => {
  const thread = [msg('a', 'them', 1), msg('b', 'them', 2), msg('c', 'them', 20)];
  assert.deepEqual(unseenMessages(thread, { userId: 'me', cursor: at(1), now }).map(m => m.id), ['b', 'c']);
});

test('Message notifications: what I replied to counts as read, even from another device', () => {
  const thread = [msg('a', 'them', 1), msg('b', 'them', 2), msg('mine', 'me', 3), msg('c', 'them', 10)];
  assert.deepEqual(unseenMessages(thread, { userId: 'me', cursor: at(0), now }).map(m => m.id), ['c']);
});

test('Message notifications: opening the conversation marks it read', () => {
  const thread = [msg('a', 'them', 5), msg('b', 'them', 6)];
  assert.deepEqual(unseenMessages(thread, { userId: 'me', cursor: at(0), readAt: at(6), now }), []);
});

test('Message notifications: no pop-ups while I am actively chatting', () => {
  const thread = [msg('mine', 'me', 28), msg('x', 'them', 29)];
  assert.deepEqual(unseenMessages(thread, { userId: 'me', cursor: at(0), now }), []);
  assert.deepEqual(unseenMessages(thread, { userId: 'me', cursor: at(0), now: now + 10 * 60_000 }).map(m => m.id), ['x'], 'after the chat goes quiet, new messages notify again');
});
