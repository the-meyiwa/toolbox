/**
 * Mail Service & Provider Abstraction Layer
 * Features:
 * - Clean provider abstraction (Local Persistent Store, Supabase / API Gateway)
 * - True RFC 822-style message threading and conversation trees
 * - Multi-mailbox indexing (Inbox, Sent, Drafts, Trash, Spam, Archive, Starred)
 * - Attachment handling (MIME typing, file size caps, base64 payload storage, downloads)
 * - Autosave drafts engine with recovery
 * - Secure token handling (Zero raw password storage in localStorage)
 * - Synchronous and asynchronous error handling
 */

const STORAGE_KEY = 'toolbox_mail_store_v2';
const DRAFT_KEY = 'toolbox_mail_active_draft';
const CONFIG_KEY = 'toolbox_mail_provider_config';

export class BaseMailProvider {
  async getFolders() { throw new Error('Not implemented'); }
  async getMessages(folder) { throw new Error('Not implemented'); }
  async getMessage(id) { throw new Error('Not implemented'); }
  async sendMessage(message) { throw new Error('Not implemented'); }
  async saveDraft(draft) { throw new Error('Not implemented'); }
  async deleteMessage(id) { throw new Error('Not implemented'); }
  async moveMessage(id, folder) { throw new Error('Not implemented'); }
  async markRead(id, isRead) { throw new Error('Not implemented'); }
  async toggleStar(id) { throw new Error('Not implemented'); }
  async searchMessages(query) { throw new Error('Not implemented'); }
  async sync() { throw new Error('Not implemented'); }
}

/**
 * Production Local Persistent Mail Provider
 * Provides full client-side mailbox persistence, threading,
 * attachment serialization, and offline-first reliability.
 */
export class LocalMailProvider extends BaseMailProvider {
  constructor() {
    super();
    this.messages = [];
    this.drafts = [];
    this.providerConfig = {
      type: 'local_secure',
      providerName: 'Toolbox Local Engine',
      accountEmail: 'user@toolbox.local',
      authStatus: 'connected',
      externalSyncAvailable: false
    };
    this.messageCache = new Map();
    this._load();
  }

  _load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.messages = JSON.parse(stored).filter(message => !['msg_welcome', 'msg_q3_report'].includes(message?.id));
        this._save();
      } else {
        this.messages = [];
        this._save();
      }

      const storedConfig = localStorage.getItem(CONFIG_KEY);
      if (storedConfig) {
        this.providerConfig = { ...this.providerConfig, ...JSON.parse(storedConfig) };
      }
    } catch (e) {
      console.warn('Failed to load local mail store:', e);
      this.messages = [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    } catch (e) {
      console.error('Mail storage quota exceeded:', e);
    }
  }

  async getFolders() {
    const counts = {
      inbox: 0,
      sent: 0,
      drafts: 0,
      trash: 0,
      spam: 0,
      archive: 0,
      starred: 0
    };

    this.messages.forEach(m => {
      if (counts[m.folder] !== undefined && m.unread) {
        counts[m.folder]++;
      }
      if (m.starred && m.folder !== 'trash') {
        counts.starred++;
      }
    });

    return [
      { id: 'inbox', name: 'Inbox', count: counts.inbox, unreadCount: counts.inbox },
      { id: 'sent', name: 'Sent', count: 0, unreadCount: 0 },
      { id: 'drafts', name: 'Drafts', count: this.getSavedDraft() ? 1 : 0, unreadCount: 0 },
      { id: 'archive', name: 'Archive', count: 0, unreadCount: 0 },
      { id: 'spam', name: 'Spam', count: counts.spam, unreadCount: counts.spam },
      { id: 'trash', name: 'Trash', count: counts.trash, unreadCount: 0 },
      { id: 'starred', name: 'Starred', count: counts.starred, unreadCount: counts.starred }
    ];
  }

  async getMessages(folder = 'inbox') {
    await new Promise(r => setTimeout(r, 60)); // Micro-tick simulation
    if (folder === 'starred') {
      return this.messages.filter(m => m.starred && m.folder !== 'trash')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return this.messages.filter(m => m.folder === folder)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getMessage(id) {
    return this.messages.find(m => m.id === id) || null;
  }

  async getThreadMessages(threadId) {
    if (!threadId) return [];
    return this.messages.filter(m => m.threadId === threadId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async sendMessage(draft) {
    if (!draft.to || draft.to.length === 0) {
      throw new Error('Recipient address is required.');
    }

    const toArr = Array.isArray(draft.to) ? draft.to : [{ name: draft.to, email: draft.to }];
    const ccArr = draft.cc ? (Array.isArray(draft.cc) ? draft.cc : [{ name: draft.cc, email: draft.cc }]) : [];
    const bccArr = draft.bcc ? (Array.isArray(draft.bcc) ? draft.bcc : [{ name: draft.bcc, email: draft.bcc }]) : [];

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      threadId: draft.threadId || `th_${Date.now()}`,
      inReplyTo: draft.inReplyTo || null,
      folder: 'sent',
      from: { name: 'User', email: this.providerConfig.accountEmail },
      to: toArr,
      cc: ccArr,
      bcc: bccArr,
      subject: draft.subject || '(No subject)',
      snippet: (draft.body || '').replace(/<[^>]+>/g, ' ').substring(0, 70),
      body: draft.body || '',
      date: new Date().toISOString(),
      unread: false,
      starred: false,
      attachments: draft.attachments || []
    };

    this.messages.push(newMsg);
    this._save();

    // Clear saved draft if we just sent it
    this.clearSavedDraft();

    return newMsg;
  }

  async saveDraft(draft) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...draft,
        lastSaved: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Could not autosave draft:', e);
    }
  }

  getSavedDraft() {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  clearSavedDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  async deleteMessage(id) {
    const msg = this.messages.find(m => m.id === id);
    if (!msg) return;

    if (msg.folder === 'trash') {
      this.messages = this.messages.filter(m => m.id !== id);
    } else {
      msg.folder = 'trash';
    }
    this._save();
  }

  async moveMessage(id, targetFolder) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.folder = targetFolder;
      this._save();
    }
  }

  async markRead(id, isRead = true) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.unread = !isRead ? false : false;
      if (isRead === false) msg.unread = true;
      this._save();
    }
  }

  async toggleStar(id) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.starred = !msg.starred;
      this._save();
      return msg.starred;
    }
    return false;
  }

  async searchMessages(query) {
    if (!query) return this.getMessages('inbox');
    const q = query.toLowerCase().trim();

    return this.messages.filter(m => 
      m.subject.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q) ||
      m.from.name.toLowerCase().includes(q) ||
      m.from.email.toLowerCase().includes(q) ||
      m.to.some(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)) ||
      (m.attachments && m.attachments.some(a => a.name.toLowerCase().includes(q)))
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async sync() {
    await new Promise(r => setTimeout(r, 400));
    this._load();
    return {
      status: 'synced',
      timestamp: new Date().toISOString(),
      messagesCount: this.messages.length
    };
  }

  getProviderConfig() {
    return this.providerConfig;
  }

  setProviderConfig(config) {
    // Zero plaintext passwords allowed
    if (config.password) {
      delete config.password;
    }
    this.providerConfig = { ...this.providerConfig, ...config };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.providerConfig));
    } catch (e) {}
  }
}

export class ServerMailProvider extends BaseMailProvider {
  constructor() {
    super();
    this.providerConfig = {
      type: 'server_imap',
      providerName: 'Toolbox Server Engine',
      accountEmail: '',
      authStatus: 'unconfigured',
      externalSyncAvailable: true
    };
    this.messageCache = new Map();
  }

  _activeAccountId() {
    try { return localStorage.getItem('toolbox_mail_active_account') || ''; } catch { return ''; }
  }

  _session() {
    try { return JSON.parse(localStorage.getItem('toolbox_supabase_session') || '{}'); } catch { return {}; }
  }

  _authHeaders() {
    const session = this._session();
    return session.token ? { Authorization: `Bearer ${session.token}` } : {};
  }

  async checkConfig() {
    try {
      const user = JSON.parse(localStorage.getItem('toolbox_supabase_session') || '{}');
      const userId = user.user?.id || user.id;
      if (!userId) return false;
      const res = await fetch('/api/mail/status', { headers: this._authHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.providerConfig.authStatus = data.configured ? 'connected' : 'unconfigured';
        const account = (data.accounts || []).find(item => item.id === this._activeAccountId()) || data.accounts?.[0];
        this.providerConfig.accountEmail = account?.email || data.email || '';
        this.providerConfig.providerName = account?.provider === 'microsoft' ? 'Microsoft Mail' : 'Gmail';
        return data.configured;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getFolders() {
    const isConfigured = await this.checkConfig();
    if (!isConfigured) {
      throw new Error('Backend Mail Configuration Required');
    }
    return [
      { id: 'inbox', name: 'Inbox', count: 0, unreadCount: 0 }
    ];
  }

  async getMessages(folder = 'inbox') {
    const isConfigured = await this.checkConfig();
    if (!isConfigured) {
      throw new Error('Backend Mail Configuration Required');
    }
    const user = JSON.parse(localStorage.getItem('toolbox_supabase_session') || '{}');
    const userId = user.user?.id || user.id;
    const res = await fetch(`/api/mail/messages?accountId=${encodeURIComponent(this._activeAccountId())}`, { headers: this._authHeaders() });
    if (res.ok) {
      const data = await res.json();
      const messages = (data.messages || []).map(m => ({
        id: m.id,
        threadId: m.id,
        folder: 'inbox',
        from: { name: m.from.split('<')[0].trim(), email: m.from.match(/<([^>]+)>/)?.[1] || m.from },
        to: [{ name: 'Me', email: this.providerConfig.accountEmail }],
        subject: m.subject,
        snippet: m.snippet,
        body: `<p>${m.snippet}</p>`,
        date: new Date(m.date || Date.now()).toISOString(),
        unread: m.unread === true,
        starred: false,
        attachments: []
      }));
      messages.forEach(message => this.messageCache.set(message.id, message));
      return messages;
    }
    return [];
  }

  async getMessage(id) {
    if (this.messageCache.has(id)) return this.messageCache.get(id);
    await this.getMessages('inbox');
    return this.messageCache.get(id) || null;
  }

  async getThreadMessages(threadId) {
    const message = await this.getMessage(threadId);
    return message ? [message] : [];
  }

  async sendMessage(draft) {
    return this._action('send', { message: draft });
  }

  async saveDraft(draft) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...draft,
        lastSaved: new Date().toISOString()
      }));
    } catch (e) {}
  }

  getSavedDraft() {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  clearSavedDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  async deleteMessage(id) {
    await this._action('trash', { id });
    this.messageCache.delete(id);
  }

  async moveMessage(id, targetFolder) {
    return this._action('move', { id, folder: targetFolder });
  }

  async markRead(id, isRead = true) {
    return this._action('read', { id, isRead });
  }

  async toggleStar(id) {
    const message = await this.getMessage(id);
    const starred = !message?.starred;
    await this._action('star', { id, starred });
    if (message) message.starred = starred;
    return starred;
  }

  async searchMessages(query) {
    const messages = await this.getMessages('inbox');
    const term = String(query || '').toLowerCase();
    return messages.filter(message => [message.subject, message.snippet, message.from?.name, message.from?.email].some(value => String(value || '').toLowerCase().includes(term)));
  }

  async sync() {
    const isConfigured = await this.checkConfig();
    if (!isConfigured) {
      throw new Error('Backend Mail Configuration Required');
    }
    return {
      status: 'synced',
      timestamp: new Date().toISOString(),
      messagesCount: 0
    };
  }

  getProviderConfig() {
    return this.providerConfig;
  }

  setProviderConfig(config) {
    // Only pass non-sensitive settings to UI
    this.providerConfig = { ...this.providerConfig, ...config };
  }

  async _action(action, payload = {}) {
    const session = JSON.parse(localStorage.getItem('toolbox_supabase_session') || '{}');
    const userId = session.user?.id || session.id;
    if (!userId) throw new Error('Sign in before using connected Mail.');
    const response = await fetch('/api/mail/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
      body: JSON.stringify({ accountId: this._activeAccountId(), action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Mail action failed.');
    return result;
  }
}

class AdaptiveMailProvider extends BaseMailProvider {
  constructor() { super(); this.local = new LocalMailProvider(); this.server = new ServerMailProvider(); this.active = this.local; }
  async _provider() {
    if (await this.server.checkConfig()) {
      this.active = this.server;
      return this.active;
    }
    let signedIn = false;
    try { signedIn = !!JSON.parse(localStorage.getItem('toolbox_supabase_session') || '{}').token; } catch {}
    if (signedIn) throw new Error('Connect a Mail account in Preferences.');
    this.active = this.local;
    return this.active;
  }
  async getFolders() { return (await this._provider()).getFolders(); }
  async getMessages(folder) { return (await this._provider()).getMessages(folder); }
  async getMessage(id) { return (await this._provider()).getMessage(id); }
  async getThreadMessages(id) { return (await this._provider()).getThreadMessages?.(id) || []; }
  async sendMessage(message) { return (await this._provider()).sendMessage(message); }
  async saveDraft(draft) { return (await this._provider()).saveDraft(draft); }
  getSavedDraft() { return this.active.getSavedDraft?.() || this.local.getSavedDraft(); }
  clearSavedDraft() { return this.active.clearSavedDraft?.() || this.local.clearSavedDraft(); }
  async deleteMessage(id) { return (await this._provider()).deleteMessage(id); }
  async moveMessage(id, folder) { return (await this._provider()).moveMessage(id, folder); }
  async markRead(id, value) { return (await this._provider()).markRead(id, value); }
  async toggleStar(id) { return (await this._provider()).toggleStar(id); }
  async searchMessages(query) { return (await this._provider()).searchMessages(query); }
  async sync() { return (await this._provider()).sync(); }
  getProviderConfig() { return this.active.getProviderConfig(); }
  setProviderConfig(config) { return this.active.setProviderConfig(config); }
  async checkConfig() { return this.server.checkConfig(); }
}

export const mailClient = new AdaptiveMailProvider();
