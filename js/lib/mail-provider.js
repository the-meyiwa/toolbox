/* ============================================================
   TOOLBOX — Mail API client
   Thin wrapper around /api/mail/* (server-mail.js). Every call is
   made as the signed-in Toolbox user; mailbox tokens never reach
   the browser. The active mailbox is remembered per browser.
   ============================================================ */

import { getCurrentUser, refreshUserSession } from './supabase.js';

const ACTIVE_KEY = 'toolbox_mail_active_account';

export class MailApiError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}

function authHeaders() {
  const user = getCurrentUser();
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
}

async function request(path, { method = 'GET', params, body, blob = false, retried = false, signal } = {}) {
  if (!getCurrentUser()?.token) throw new MailApiError('Sign in to Toolbox to use Mail.', 401, 'signin');
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]))}` : '';
  let res;
  try {
    res = await fetch(`/api/mail/${path}${qs}`, {
      method,
      signal,
      headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new MailApiError('Could not reach the Mail service. Check your connection.', 0, 'network');
  }
  if (res.status === 401 && !retried) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.code === 'signin') {
      const before = getCurrentUser()?.token;
      const after = (await refreshUserSession())?.token;
      if (after && after !== before) return request(path, { method, params, body, blob, retried: true, signal });
    }
  }
  if (blob) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new MailApiError(data.error || 'Download failed.', res.status, data.code);
    }
    return res.blob();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const fallback = res.status === 404 ? 'The Mail service is not available on this deployment.' : 'Mail request failed.';
    throw new MailApiError(data.error || fallback, res.status, data.code || '');
  }
  return data;
}

export const mailApi = {
  get activeAccountId() { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } },
  set activeAccountId(id) { try { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); } catch { /* storage blocked */ } },

  status() { return request('status'); },
  oauthInit(provider, hint = '') { return request('oauth/init', { params: { provider, hint } }); },
  folders(accountId) { return request('folders', { params: { accountId } }); },

  /** { accountId, folder, q, pageToken, limit, threads } → { messages, nextPageToken } */
  messages({ accountId, folder, q, pageToken, limit = 30, threads = false, signal } = {}) {
    return request('messages', { params: { accountId, folder, q, pageToken, limit, threads: threads ? 1 : '' }, signal });
  },
  message(accountId, id, signal) { return request('message', { params: { accountId, id }, signal }).then(d => d.message); },
  thread(accountId, id, signal) { return request('thread', { params: { accountId, id }, signal }).then(d => d.thread); },
  attachment(accountId, messageId, att) {
    return request('attachment', { params: { accountId, messageId, id: att.id, filename: att.filename, mimeType: att.mimeType }, blob: true });
  },

  /** { to, cc, bcc, subject, html, text, inReplyTo, references, threadId, replyToId, mode, attachments } */
  send(accountId, message) { return request('send', { method: 'POST', body: { accountId, ...message } }); },

  /** action: read | unread | star | unstar | archive | trash | untrash | spam | notspam | move | label | restore */
  action(accountId, action, ids, extra = {}) {
    return request('action', { method: 'POST', body: { accountId, action, ids: [].concat(ids), ...extra } });
  },
  disconnect(accountId) { return request('disconnect', { method: 'POST', body: { accountId } }); },
};

/* Compatibility alias for older imports. */
export const mailClient = mailApi;
