/* ============================================================
   TOOLBOX — Assistant conversation store

   Many conversations per account, kept in localStorage (scoped
   to the signed-in user) and mirrored to the account's cloud
   copy (saveAssistantConversationToCloud) so history follows
   the person across devices. The single-conversation history
   written by earlier versions is migrated on first load.
   ============================================================ */

import { conversationPersistence, getAssistantHistoryStorageKey } from '../assistant-message-persistence.js';
import { getCurrentUser, saveAssistantConversationToCloud, fetchAssistantConversationsFromCloud } from '../supabase.js';

const MAX_CONVERSATIONS = 60;
const MAX_STRING = 180000;        // longest string kept in a stored tool result
const MAX_FILE_BYTES = 350000;    // attachments larger than this are stored without their bytes

function storageKey() {
  const user = getCurrentUser();
  const who = user?.id || user?.email || getAssistantHistoryStorageKey().replace('toolbox_assistant_history_', '') || 'guest';
  return `toolbox_assistant_conversations_v1_${who}`;
}

export function newId(prefix = 'c') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Drops values that cannot or should not be stored (functions, DOM, huge blobs). */
function compactValue(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, 2000)}… [${Math.round(value.length / 1024)} KB not stored]` : value;
  if (typeof value !== 'object') return typeof value === 'function' ? undefined : value;
  if (depth > 8) return undefined;
  if (typeof Node !== 'undefined' && value instanceof Node) return undefined;
  if (Array.isArray(value)) return value.slice(0, 400).map(v => compactValue(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'element' || k === 'node' || k === 'instance' || typeof v === 'function') continue;
    const c = compactValue(v, depth + 1);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

function compactFile(file) {
  if (!file) return null;
  const tooBig = (file.base64?.length || 0) * 0.75 > MAX_FILE_BYTES;
  return {
    name: file.name, type: file.type, size: file.size,
    base64: tooBig ? null : file.base64 || null,
    text: typeof file.text === 'string' ? file.text.slice(0, MAX_STRING) : null,
  };
}

export function compactMessage(msg) {
  const out = compactValue({ ...msg, fileData: undefined });
  if (msg.fileData) out.fileData = compactFile(msg.fileData);
  return out;
}

function titleFrom(messages) {
  const first = messages.find(m => m.role === 'user');
  const text = String(first?.displayText ?? first?.content ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return first?.attachments?.[0]?.name || 'New chat';
  return text.length > 60 ? `${text.slice(0, 57).trim()}…` : text;
}

export class ConversationStore {
  constructor() {
    this.key = storageKey();
    this.conversations = [];
    this.activeId = null;
    this.listeners = new Set();
    this.syncTimer = null;
    this.syncState = 'idle';    // idle | syncing | synced | offline
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) { try { fn(this); } catch { /* ignore */ } } }

  async load() {
    this.key = storageKey();
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (raw?.conversations) {
        this.conversations = raw.conversations;
        this.activeId = raw.activeId || null;
        this.deleted = raw.deleted || [];
      }
    } catch { /* corrupt → start fresh */ }
    if (!this.conversations.length) await this.migrateLegacy();
    this.sort();
    return this;
  }

  /** Imports the single conversation kept by earlier versions. */
  async migrateLegacy() {
    try {
      const legacy = await conversationPersistence.loadConversation();
      if (!legacy.length) return;
      const messages = legacy.map(m => ({
        id: m.id, turnId: m.turnId, role: m.role, content: m.content,
        toolResults: (m.toolResults || []).map(r => r?.data || r),
        status: m.status, error: m.error, timestamp: m.timestamp,
        fileData: m.fileData || null,
        attachments: m.filePreview ? [{ name: m.filePreview.name, size: m.filePreview.size }] : [],
      }));
      const conv = {
        id: newId(), title: titleFrom(messages),
        createdAt: messages[0]?.timestamp || Date.now(), updatedAt: messages[messages.length - 1]?.timestamp || Date.now(),
        messages,
      };
      this.conversations = [conv];
      this.save({ sync: false });
    } catch { /* nothing to migrate */ }
  }

  sort() { this.conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }

  get active() { return this.conversations.find(c => c.id === this.activeId) || null; }

  create() {
    const conv = { id: newId(), title: 'New chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    this.conversations.unshift(conv);
    this.activeId = conv.id;
    return conv;
  }

  select(id) { this.activeId = id; this.save({ sync: false }); this.emit(); }

  rename(id, title) {
    const c = this.conversations.find(x => x.id === id);
    if (!c) return;
    c.title = String(title || '').trim().slice(0, 120) || c.title;
    c.customTitle = true;
    c.updatedAt = Date.now();
    this.sort();
    this.save();
    this.emit();
  }

  remove(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    if (this.activeId === id) this.activeId = null;
    this.deleted = [...(this.deleted || []), id].slice(-200);
    this.save();
    this.emit();
  }

  /** Stores the messages of a conversation (creating it if needed). */
  put(conv, messages) {
    let c = this.conversations.find(x => x.id === conv.id);
    if (!c) { c = conv; this.conversations.unshift(c); }
    c.messages = messages.map(compactMessage);
    if (!c.customTitle) c.title = titleFrom(messages);
    c.updatedAt = Date.now();
    this.sort();
    this.save();
    this.emit();
  }

  save({ sync = true } = {}) {
    const payload = () => JSON.stringify({ conversations: this.conversations.filter(c => c.messages?.length), activeId: this.activeId, deleted: this.deleted || [] });
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        localStorage.setItem(this.key, payload());
        break;
      } catch {
        // Out of space: drop the oldest conversation and try again.
        const withMessages = this.conversations.filter(c => c.messages?.length);
        if (withMessages.length <= 1) break;
        const oldest = withMessages[withMessages.length - 1];
        this.conversations = this.conversations.filter(c => c !== oldest);
      }
    }
    if (this.conversations.length > MAX_CONVERSATIONS) this.conversations.length = MAX_CONVERSATIONS;
    if (sync) this.scheduleSync();
  }

  /* ---------- cloud ---------- */

  scheduleSync() {
    if (!getCurrentUser()) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.pushCloud(), 2500);
  }

  async pushCloud() {
    if (!getCurrentUser()) return;
    this.syncState = 'syncing'; this.emit();
    const conversations = this.conversations.filter(c => c.messages?.length).slice(0, 40).map(c => ({
      ...c,
      // Attachment bytes stay on this device; the cloud copy keeps names and text.
      messages: c.messages.map(m => (m.fileData ? { ...m, fileData: { ...m.fileData, base64: null } } : m)),
    }));
    const ok = await saveAssistantConversationToCloud({ version: 2, updatedAt: Date.now(), conversations, deleted: this.deleted || [] }).catch(() => false);
    this.syncState = ok ? 'synced' : 'offline';
    this.emit();
  }

  /** Merges the cloud copy into the local list (newest version of each conversation wins). */
  async pullCloud() {
    if (!getCurrentUser()) return false;
    let data = null;
    try { data = await fetchAssistantConversationsFromCloud(); } catch { return false; }
    if (!data || data.version !== 2 || !Array.isArray(data.conversations)) return false;
    const deleted = new Set([...(this.deleted || []), ...(data.deleted || [])]);
    const byId = new Map(this.conversations.map(c => [c.id, c]));
    let changed = false;
    for (const remote of data.conversations) {
      if (!remote?.id || deleted.has(remote.id)) continue;
      const local = byId.get(remote.id);
      if (!local || (remote.updatedAt || 0) > (local.updatedAt || 0)) {
        byId.set(remote.id, local ? { ...remote, messages: mergeFiles(local.messages, remote.messages) } : remote);
        changed = true;
      }
    }
    for (const id of deleted) if (byId.delete(id)) changed = true;
    if (changed) {
      this.conversations = [...byId.values()];
      this.deleted = [...deleted].slice(-200);
      this.sort();
      this.save({ sync: false });
      this.emit();
    }
    this.syncState = 'synced';
    return changed;
  }
}

/** Keeps attachment bytes from the local copy when the cloud copy has none. */
function mergeFiles(localMsgs = [], remoteMsgs = []) {
  const local = new Map(localMsgs.map(m => [m.id, m]));
  return remoteMsgs.map(m => {
    const l = local.get(m.id);
    if (m.fileData && !m.fileData.base64 && l?.fileData?.base64) return { ...m, fileData: l.fileData };
    return m;
  });
}
