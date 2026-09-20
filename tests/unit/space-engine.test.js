/* ============================================================
   Space Engine & Collaboration Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();

const { getUserProfile, saveUserProfile, listJoinedSpaces, saveJoinedSpace, removeJoinedSpace, getJoinedSpace } = await import('../../js/lib/space-engine.js');

test('SpaceEngine: user profile management', () => {
  const profile = getUserProfile();
  assert.ok(profile.id);
  assert.ok(profile.color);

  const updated = saveUserProfile({ name: 'Alex Rivera' });
  assert.equal(updated.name, 'Alex Rivera');
  assert.equal(getUserProfile().name, 'Alex Rivera');
});

test('SpaceEngine: joined spaces bookmarks persistence', () => {
  const spaceCode = 'TEST99';
  saveJoinedSpace({
    id: spaceCode,
    name: 'Marketing Launch Desk',
    description: 'Campaign assets',
    role: 'owner',
  });

  const found = getJoinedSpace(spaceCode);
  assert.ok(found);
  assert.equal(found.id, spaceCode);
  assert.equal(found.name, 'Marketing Launch Desk');

  const all = listJoinedSpaces();
  assert.ok(all.some(s => s.id === spaceCode));

  removeJoinedSpace(spaceCode);
  assert.equal(getJoinedSpace(spaceCode), null);
});

test('SpaceEngine: incoming chat notifications ignore history, own messages and repeat edits', async () => {
  const { SpaceEngine } = await import('../../js/lib/space-engine.js');
  const { NotificationEngine } = await import('../../js/lib/notifications.js');
  const delivered = [];
  const originalAdd = NotificationEngine.addNotification;
  NotificationEngine.addNotification = async (...args) => { delivered.push(args); };
  const now = Date.now();
  let messages = [{ id: 'existing', from: 'peer', time: now - 10000 }];
  let callback;
  const chat = { toArray: () => messages, observe: fn => { callback = fn; } };
  const context = { chat, user: { id: 'self' }, spaceName: 'Test room', roomCode: 'ROOM1', _observers: [] };
  SpaceEngine.prototype._watchChatNotifications.call(context);
  messages.push({ id: 'old-sync', from: 'peer', time: now - 10000 });
  messages.push({ id: 'own', from: 'self', time: now + 1 });
  messages.push({ id: 'incoming', from: 'peer', name: 'Peer', text: 'Hello', time: now + 1 });
  try {
    callback(); callback();
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0][3], '#messaging?code=ROOM1');
    assert.equal(context._observers.length, 1);
  } finally {
    NotificationEngine.addNotification = originalAdd;
  }
});
