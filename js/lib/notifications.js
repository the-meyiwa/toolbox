import { getCurrentUser } from './supabase.js';
import { getSettings, updateSettings } from './settings.js';

const memory = new Map();
const keyForUser = () => `toolbox_notifications_${getCurrentUser()?.id || 'anonymous'}`;
export function safeNotificationLink(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('#')) return value;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function read(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data.filter(n => n && typeof n.id === 'string' && typeof n.title === 'string').slice(0, 200) : [];
  } catch { return memory.get(key) || []; }
}
function write(key, items) {
  const limited = items.slice(0, 200);
  memory.set(key, limited);
  try { localStorage.setItem(key, JSON.stringify(limited)); } catch { /* Session fallback when storage is unavailable. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toolbox:notifications-updated'));
}
let soundContext;
export function prepareNotificationSound() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    soundContext ||= new Audio();
    void soundContext.resume().catch(() => {});
  } catch { /* Sound is optional. */ }
}
function chime() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    const ctx = soundContext;
    if (!ctx || ctx.state !== 'running') return;
    const tone = ctx.createOscillator(); const volume = ctx.createGain();
    tone.frequency.value = 660; volume.gain.setValueAtTime(0.08, ctx.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    tone.connect(volume); volume.connect(ctx.destination); tone.start(); tone.stop(ctx.currentTime + 0.2);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  } catch { /* Browser audio permissions must not prevent delivery. */ }
}
/* ---------------- delivery ----------------
   The bell list is written first; then, depending on settings and whether the page is in view:
   - in view: a toast (and the chime);
   - hidden or in another window: a system notification. Mobile browsers (Chrome on Android)
     only allow those through a service worker, so it is shown with
     registration.showNotification, falling back to new Notification on desktop browsers
     without one. Clicking it focuses Toolbox on the notification's link (handled in the
     service worker, pg-sw.js, which is the one service worker for this origin). */

const SW_URL = '/pg-sw.js';
let swPromise = null;
export function registration() {
  if (swPromise) return swPromise;
  swPromise = (async () => {
    try {
      const sw = globalThis.navigator?.serviceWorker;
      if (!sw || !globalThis.isSecureContext) return null;
      const existing = await sw.getRegistration('/');
      if (existing) return existing;
      return await sw.register(SW_URL, { scope: '/' });
    } catch { return null; }
  })();
  return swPromise;
}

const pageInView = () => typeof document !== 'undefined' && document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus());

async function systemAlert(notification, markRead) {
  if (globalThis.Notification?.permission !== 'granted') return false;
  const options = {
    body: notification.message,
    tag: notification.sourceId || notification.id,
    icon: '/logo.png',
    badge: '/logo.png',
    data: { link: notification.link, id: notification.id },
    renotify: Boolean(notification.sourceId),
  };
  const reg = await registration();
  if (reg?.showNotification) {
    try { await reg.showNotification(notification.title, options); return true; } catch { /* fall through */ }
  }
  try {
    const alert = new Notification(notification.title, options);
    alert.onclick = () => { window.focus(); if (notification.link?.startsWith('#')) window.location.hash = notification.link; void markRead(notification.id); alert.close(); };
    return true;
  } catch { return false; }   // e.g. Android Chrome without a service worker
}

async function toast(notification) {
  try {
    const { showToast } = await import('../utils.js');
    showToast(`${notification.title}: ${notification.message}`.slice(0, 180), notification.type === 'error' ? 'error' : 'info', 5000);
  } catch { /* the bell still has it */ }
}

function updateAppBadge() {
  try {
    const n = read(keyForUser()).filter(x => !x.read).length;
    if (n) void globalThis.navigator?.setAppBadge?.(n)?.catch?.(() => {});
    else void globalThis.navigator?.clearAppBadge?.()?.catch?.(() => {});
  } catch { /* optional */ }
}

function deliver(notification, markRead) {
  const settings = getSettings();
  if (settings.notificationSound) chime();
  updateAppBadge();
  if (typeof document === 'undefined') return;
  if (pageInView()) {
    if (notification.type !== 'message' || !String(globalThis.location?.hash || '').startsWith('#messaging')) void toast(notification);
    return;
  }
  if (settings.notificationsPush) void systemAlert(notification, markRead);
}

// Browsers only let sound start after a gesture: unlock the chime on the first tap or key press.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const unlock = () => { if (getSettings().notificationSound) prepareNotificationSound(); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
  window.addEventListener('toolbox:notifications-updated', updateAppBadge);
  // A tapped system notification (from the service worker) opens its link here.
  globalThis.navigator?.serviceWorker?.addEventListener?.('message', (event) => {
    const msg = event.data || {};
    if (msg.type !== 'toolbox-open') return;
    const link = safeNotificationLink(msg.link);
    if (link?.startsWith('#')) window.location.hash = link;
    if (typeof msg.id === 'string') void NotificationEngine.markAsRead(msg.id);
  });
  // Permission already granted on an earlier visit: make sure the worker is there to show alerts.
  if (globalThis.Notification?.permission === 'granted' && getSettings().notificationsPush) setTimeout(() => { void registration(); }, 3000);
}

export class NotificationEngine {
  static async getNotifications() { return read(keyForUser()); }
  static async saveNotifications(items) { write(keyForUser(), items); }
  static async addNotification(title, message, type = 'info', link = null, sourceId = null, data = null) {
    if (getSettings().notificationsEnabled === false) return null;
    // No awaits between reading and writing: simultaneous incoming messages cannot overwrite each other.
    const key = keyForUser(); const items = read(key);
    if (sourceId && items.some(n => n.sourceId === sourceId)) return null;
    const notification = { id: `ntf_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`,
      title: String(title), message: String(message), type, link: safeNotificationLink(link), sourceId,
      data: data && typeof data === 'object' ? data : null,
      date: new Date().toISOString(), read: false };
    write(key, [notification, ...items]);
    deliver(notification, (id) => this.markAsRead(id));
    return notification;
  }
  static async enableBrowserNotifications() {
    if (!globalThis.Notification?.requestPermission) return 'unsupported';
    prepareNotificationSound();
    const permission = await Notification.requestPermission();
    updateSettings({ notificationsPush: permission === 'granted' });
    if (permission === 'granted') void registration();
    return permission;
  }
  /** Sends a sample through every enabled channel, so the person can see their settings work. */
  static async sendTest() {
    return this.addNotification('Notifications are on', 'This is how Toolbox alerts will look.', 'info', null, `test-${Date.now()}`);
  }
  static async markAsRead(id) {
    const key = keyForUser(); write(key, read(key).map(n => n.id === id ? { ...n, read: true } : n));
  }
  static async markAllAsRead() { const key = keyForUser(); write(key, read(key).map(n => ({ ...n, read: true }))); }
  static async clearWhere(predicate) { const key = keyForUser(); write(key, read(key).filter(n => !predicate(n))); }
  static async clearConversation(conversationId) { return this.clearWhere(n => n.data?.conversationId === conversationId); }
  static async clearAll() { write(keyForUser(), []); }
  static async getUnreadCount() { return read(keyForUser()).filter(n => !n.read).length; }
}
