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
    const settings = getSettings();
    if (settings.notificationSound) chime();
    try {
      if (settings.notificationsPush && globalThis.Notification?.permission === 'granted') {
        const alert = new Notification(notification.title, { body: notification.message, tag: sourceId || notification.id });
        alert.onclick = () => { window.focus(); if (notification.link?.startsWith('#')) window.location.hash = notification.link; void this.markAsRead(notification.id); alert.close(); };
      }
    } catch { /* In-app delivery remains available on browsers without desktop alerts. */ }
    return notification;
  }
  static async enableBrowserNotifications() {
    if (!globalThis.Notification?.requestPermission) return 'unsupported';
    const permission = await Notification.requestPermission();
    updateSettings({ notificationsPush: permission === 'granted' });
    return permission;
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
