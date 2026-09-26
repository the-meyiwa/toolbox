import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { readStylesheet } from '../helpers/stylesheet.js';

test('Notifications: index.html has notification button and badge', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
  assert.ok(html.includes('id="header-notif-btn"'), 'index.html must include #header-notif-btn');
  assert.ok(html.includes('id="header-notif-badge"'), 'index.html must include #header-notif-badge');
  assert.ok(html.includes('header-notif-btn'), 'index.html must have header-notif-btn class');
});

test('Notifications: css/style.css defines notification button and badge styles', () => {
  const css = readStylesheet();
  // The bell reuses the circular header button; only the badge needs its own rules.
  assert.ok(/\.header-avatar-btn\s*\{/.test(css), 'css/style.css must style .header-avatar-btn, which the bell uses');
  assert.ok(/\.header-notif-badge\s*\{[^}]*position:\s*absolute/.test(css), '.header-notif-badge must be positioned over the bell');
});

test('Notifications: NotificationEngine full lifecycle in node environment', async () => {
  // Mock localStorage and window
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
  globalThis.window = {
    dispatchEvent: () => {}
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, opts) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };

  const { NotificationEngine } = await import('../../js/lib/notifications.js');

  await NotificationEngine.clearAll();
  let initial = await NotificationEngine.getNotifications();
  assert.equal(initial.length, 0);
  assert.equal(await NotificationEngine.getUnreadCount(), 0);

  // Add 1st notification
  const n1 = await NotificationEngine.addNotification('Test Alert', 'This is a test notification', 'info', '#messaging');
  assert.ok(n1.id.startsWith('ntf_'));
  assert.equal(n1.title, 'Test Alert');
  assert.equal(n1.read, false);
  assert.equal(await NotificationEngine.getUnreadCount(), 1);

  // Add 2nd notification
  const n2 = await NotificationEngine.addNotification('Message Received', 'Hello world', 'message');
  assert.equal(await NotificationEngine.getUnreadCount(), 2);

  // Mark 1st as read
  await NotificationEngine.markAsRead(n1.id);
  assert.equal(await NotificationEngine.getUnreadCount(), 1);

  // Mark all as read
  await NotificationEngine.markAllAsRead();
  assert.equal(await NotificationEngine.getUnreadCount(), 0);

  // Clear all
  await NotificationEngine.clearAll();
  const cleared = await NotificationEngine.getNotifications();
  assert.equal(cleared.length, 0);
  assert.equal(await NotificationEngine.getUnreadCount(), 0);
});

test('Notifications: conversation messages can be cleared after viewing or replying', async () => {
  const { NotificationEngine } = await import('../../js/lib/notifications.js');
  await NotificationEngine.clearAll();
  await NotificationEngine.addNotification('Ada', 'Hello', 'message', '#messaging?conversation=one', 'message-one', { conversationId: 'one' });
  await NotificationEngine.addNotification('Grace', 'Hi', 'message', '#messaging?conversation=two', 'message-two', { conversationId: 'two' });
  await NotificationEngine.clearConversation('one');
  const remaining = await NotificationEngine.getNotifications();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].data.conversationId, 'two');
});

test('Notifications: concurrent delivery, per-account isolation, preference and malformed storage handling', async () => {
  const { NotificationEngine, safeNotificationLink } = await import('../../js/lib/notifications.js');
  const { updateSettings } = await import('../../js/lib/settings.js');
  localStorage.clear();
  updateSettings({ notificationsEnabled: true });
  await Promise.all(Array.from({ length: 25 }, (_, i) => NotificationEngine.addNotification(`Alert ${i}`, 'Incoming', 'message', '#messaging', `message-${i}`)));
  assert.equal(await NotificationEngine.getUnreadCount(), 25);
  await NotificationEngine.addNotification('Duplicate', 'Incoming', 'message', null, 'message-1');
  assert.equal(await NotificationEngine.getUnreadCount(), 25);
  updateSettings({ notificationsEnabled: false });
  assert.equal(await NotificationEngine.addNotification('Muted', 'Ignored'), null);
  assert.equal(await NotificationEngine.getUnreadCount(), 25);
  updateSettings({ notificationsEnabled: true });
  localStorage.setItem('toolbox_supabase_session', JSON.stringify({ id: 'test-account', token: 'test-session' }));
  assert.equal(await NotificationEngine.getUnreadCount(), 0);
  await NotificationEngine.addNotification('Private', 'Account notification');
  assert.equal(await NotificationEngine.getUnreadCount(), 1);
  localStorage.removeItem('toolbox_supabase_session');
  assert.equal(await NotificationEngine.getUnreadCount(), 25);
  localStorage.setItem('toolbox_notifications_anonymous', '{}');
  assert.deepEqual(await NotificationEngine.getNotifications(), []);
  assert.equal(safeNotificationLink('javascript:alert(1)'), null);
  assert.equal(safeNotificationLink('#messaging?code=ABC'), '#messaging?code=ABC');
  assert.equal(await NotificationEngine.enableBrowserNotifications(), 'unsupported');
});
