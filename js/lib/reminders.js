/* ============================================================
   TOOLBOX — Reminders

   One-off reminders kept on this device. A reminder either has
   its own time or hangs off a calendar event ("the day before"),
   in which case it follows the event when the event moves. Due
   reminders are delivered through the notification bell (and a
   desktop alert when the person allowed them) by a small clock
   that the app starts once.
   ============================================================ */

import { loadEvents } from './calendar-store.js';

export const STORAGE_KEY_REMINDERS = 'toolbox_reminders_v1';
const LIMIT = 200;

export function loadReminders() {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY_REMINDERS) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function saveReminders(list) {
  // Keep every pending reminder; drop the oldest delivered ones first when over the limit.
  const pending = list.filter(r => !r.firedAt);
  const fired = list.filter(r => r.firedAt).sort((a, b) => b.firedAt - a.firedAt);
  const kept = [...pending, ...fired].slice(0, Math.max(LIMIT, pending.length));
  try { globalThis.localStorage?.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(kept)); } catch { /* storage full or blocked */ }
  try { globalThis.dispatchEvent?.(new CustomEvent('toolbox:reminders', { detail: { reminders: kept } })); } catch { /* no window */ }
}

const pad = (n) => String(n).padStart(2, '0');
export const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "1 day", "30 min", "2 hours", "1 week", "90" (minutes) → milliseconds. */
export function parseOffset(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value * 60_000;
  const m = String(value).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wks?|weeks?)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || 'm')[0];
  return n * ({ m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit]);
}

/** When an event starts, as a Date (all-day events count from 09:00). */
export function eventStart(ev) {
  if (!ev?.date) return null;
  const time = !ev.isAllDay && /^\d{1,2}:\d{2}$/.test(ev.startTime || '') ? ev.startTime : '09:00';
  const d = new Date(`${ev.date}T${time.padStart(5, '0')}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseWhen(at) {
  if (!at) return null;
  const s = String(at).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T09:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Adds a reminder. Give either `at` (local date-time, e.g. "2026-10-02T08:00")
 * or an event (`eventId`) with an optional `before` offset (default: 1 hour).
 */
export function addReminder({ text, at, eventId, before } = {}, { events = loadEvents(), now = Date.now() } = {}) {
  let when = parseWhen(at);
  let event = null;
  let beforeMs = null;
  if (eventId) {
    event = events.find(e => e.id === eventId) || null;
    if (!event) throw new Error('That calendar event no longer exists.');
    beforeMs = parseOffset(before) ?? 3_600_000;
    if (!when) when = new Date(eventStart(event).getTime() - beforeMs);
    else beforeMs = eventStart(event).getTime() - when.getTime();
  }
  if (!when) throw new Error('Say when the reminder is for (a date and time, or an event).');
  const title = String(text || event?.title || '').trim().slice(0, 200);
  if (!title) throw new Error('Say what the reminder is about.');
  const reminder = {
    id: `rem-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: title,
    at: when.getTime(),
    eventId: event?.id || null,
    beforeMs,
    createdAt: now,
    firedAt: null,
  };
  saveReminders([...loadReminders(), reminder]);
  return reminder;
}

export function cancelReminder(idOrText) {
  const key = String(idOrText || '').toLowerCase().trim();
  if (!key) return [];
  const list = loadReminders();
  const gone = list.filter(r => !r.firedAt && (r.id === idOrText || r.text.toLowerCase().includes(key)));
  if (gone.length) saveReminders(list.filter(r => !gone.includes(r)));
  return gone;
}

export const upcomingReminders = (now = Date.now()) => loadReminders().filter(r => !r.firedAt).sort((a, b) => a.at - b.at).filter(r => r.at >= now - 86_400_000);

/** Moves the reminders attached to an event after the event moved; drops them if it was deleted. */
export function followEvent(event, { deleted = false } = {}) {
  const list = loadReminders();
  let changed = false;
  const next = [];
  for (const r of list) {
    if (r.eventId !== event?.id || r.firedAt) { next.push(r); continue; }
    changed = true;
    if (deleted) continue;
    const start = eventStart(event);
    next.push(start ? { ...r, at: start.getTime() - (r.beforeMs ?? 3_600_000) } : r);
  }
  if (changed) saveReminders(next);
}

/** Delivers due reminders. Returns the ones delivered. */
export async function fireDue({ now = Date.now(), notify } = {}) {
  let list = loadReminders();
  let due = list.filter(r => !r.firedAt && r.at <= now);
  if (!due.length) return [];
  // A reminder for an event that has since been deleted goes quietly.
  const ids = new Set(loadEvents().map(e => e.id));
  const orphans = due.filter(r => r.eventId && !ids.has(r.eventId));
  if (orphans.length) {
    list = list.filter(r => !orphans.includes(r));
    due = due.filter(r => !orphans.includes(r));
  }
  const send = notify || (async (r) => {
    const { NotificationEngine } = await import('./notifications.js');
    await NotificationEngine.addNotification('Reminder', r.text, 'reminder', r.eventId ? '#calendar' : null, r.id);
  });
  // Mark first and save, so a second tab ticking at the same moment does not deliver them again.
  for (const r of due) r.firedAt = now;
  saveReminders(list);
  for (const r of due) {
    try { await send(r); } catch { /* the bell is best effort */ }
  }
  return due;
}

let clock = null;
/** Starts checking for due reminders (every 30 s and whenever the tab comes back). */
export function startReminderClock() {
  if (clock || typeof window === 'undefined') return;
  const tick = () => { fireDue().catch(() => {}); };
  clock = setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
}
