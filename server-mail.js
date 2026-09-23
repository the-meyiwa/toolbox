/* ============================================================
   Toolbox Mail API — /api/mail/*

   Gmail (Gmail API) and Microsoft 365 / Outlook (Microsoft Graph)
   mailboxes, linked to the signed-in Toolbox (Supabase) user.

   Tokens are encrypted with AES-256-GCM and kept in the Supabase
   table `mail_accounts` (see supabase/mail_accounts.sql), written
   with the service-role key. Without Supabase REST configuration a
   local encrypted file is used instead (development only).

   Endpoints (all JSON unless noted, all need `Authorization: Bearer
   <supabase access token>` except the OAuth callback):
     GET  status                 accounts + provider readiness
     GET  oauth/init?provider=   authorization URL for the popup
     GET  oauth/callback         provider redirect → postMessage to opener
     GET  folders                folders / labels with unread counts
     GET  messages               list (folder, q, pageToken, limit, threads)
     GET  message?id=            full message (html, text, attachments)
     GET  thread?id=             conversation with full messages
     GET  attachment?messageId=&id=   raw bytes (Content-Disposition)
     POST send                   compose / reply / forward (+ attachments)
     POST action                 read, unread, star, unstar, archive, trash,
                                 untrash, spam, move, label, restore
     POST disconnect             remove an account (and revoke Google token)
   ============================================================ */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GRAPH = 'https://graph.microsoft.com/v1.0/me';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_SCOPE = 'openid profile email offline_access User.Read Mail.ReadWrite Mail.Send';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
const MAX_BODY_BYTES = 40 * 1024 * 1024;
const INLINE_IMAGE_BUDGET = 4 * 1024 * 1024;
const PAGE_DEFAULT = 30;
const PAGE_MAX = 50;

const env = (name) => process.env[name] || '';

class MailError extends Error {
  constructor(message, status = 500, code = '') { super(message); this.status = status; this.code = code; }
}

/* ---------------- small helpers ---------------- */

function mailCallbackUrl(request, configuredUrl) {
  if (configuredUrl) return configuredUrl;
  const protocol = String(request.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3000').split(',')[0].trim();
  return `${protocol}://${host}/api/mail/oauth/callback`;
}

export function encodeMailState(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function decodeMailState(value, secret) {
  const [encoded, signature] = String(value || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload?.userId || !payload?.provider || !payload?.expiresAt || Date.now() > payload.expiresAt) return null;
  return payload;
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new MailError('That message is too large to send (limit about 25 MB of attachments).', 413);
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new MailError('Invalid JSON body.', 400); }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}

const cleanHeader = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+$/;

/** Split an address-list header on commas that are outside quotes and angle brackets. */
export function parseAddressList(value) {
  const out = [];
  let cur = '', quote = false, angle = 0;
  for (const ch of String(value || '')) {
    if (ch === '"') quote = !quote;
    else if (!quote && ch === '<') angle++;
    else if (!quote && ch === '>') angle = Math.max(0, angle - 1);
    if ((ch === ',' || ch === ';') && !quote && !angle) { if (cur.trim()) out.push(parseAddress(cur)); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(parseAddress(cur));
  return out.filter(a => a.email || a.name);
}

export function parseAddress(value) {
  const s = String(value || '').trim();
  const m = s.match(/^(.*)<([^>]*)>\s*$/);
  if (m) return { name: m[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1').trim(), email: m[2].trim() };
  return { name: '', email: s.replace(/^"(.*)"$/, '$1') };
}

/** Accepts "a@b.c", {email,name}, or arrays / comma strings of them. */
function normalizeRecipients(value) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  const out = [];
  for (const item of list) {
    if (!item) continue;
    if (typeof item === 'string') out.push(...parseAddressList(item));
    else if (item.email) out.push({ name: cleanHeader(item.name || ''), email: cleanHeader(item.email) });
  }
  for (const a of out) {
    a.email = cleanHeader(a.email);
    if (!EMAIL_RE.test(a.email)) throw new MailError(`"${a.email || a.name}" is not a valid email address.`, 400);
  }
  return out;
}

/* ---------------- MIME ---------------- */

const isAscii = (s) => /^[\x20-\x7e]*$/.test(s);
function encodeWord(s) {
  s = cleanHeader(s);
  return isAscii(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}
function formatAddress({ name, email }) {
  if (!name) return email;
  const display = isAscii(name) ? `"${name.replace(/["\\]/g, '\\$&')}"` : encodeWord(name);
  return `${display} <${email}>`;
}
const wrap76 = (b64) => b64.replace(/.{1,76}/g, '$&\r\n').replace(/\r\n$/, '');
function filenameParams(filename) {
  const f = cleanHeader(filename || 'attachment').replace(/[\\"]/g, '_');
  if (isAscii(f)) return { name: `name="${f}"`, disposition: `filename="${f}"` };
  const star = `UTF-8''${encodeURIComponent(f)}`;
  return { name: `name="${encodeWord(f)}"`, disposition: `filename*=${star}` };
}
export function htmlToText(html) {
  return decodeEntities(String(html || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ''))
    .replace(/\n{3,}/g, '\n\n').trim();
}

/** RFC 5322 message with text + html alternatives and optional attachments. */
export function buildMime({ from, to = [], cc = [], bcc = [], subject = '', html = '', text = '', inReplyTo = '', references = '', attachments = [] }) {
  const rand = () => crypto.randomBytes(12).toString('hex');
  const alt = `alt_${rand()}`, mixed = `mix_${rand()}`;
  const headers = [];
  if (from) headers.push(`From: ${formatAddress(from)}`);
  if (to.length) headers.push(`To: ${to.map(formatAddress).join(', ')}`);
  if (cc.length) headers.push(`Cc: ${cc.map(formatAddress).join(', ')}`);
  if (bcc.length) headers.push(`Bcc: ${bcc.map(formatAddress).join(', ')}`);
  headers.push(`Subject: ${encodeWord(subject)}`);
  headers.push(`Date: ${new Date().toUTCString().replace('GMT', '+0000')}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${cleanHeader(inReplyTo)}`);
  if (references) headers.push(`References: ${cleanHeader(references)}`);
  headers.push('MIME-Version: 1.0');
  const plain = text || htmlToText(html);
  const altBody = [
    `--${alt}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(plain, 'utf8').toString('base64')),
    `--${alt}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(html || `<div>${plain.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>')}</div>`, 'utf8').toString('base64')),
    `--${alt}--`,
  ].join('\r\n');
  if (!attachments.length) {
    return [...headers, `Content-Type: multipart/alternative; boundary="${alt}"`, '', altBody, ''].join('\r\n');
  }
  const parts = [`--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, '', altBody];
  for (const a of attachments) {
    const p = filenameParams(a.filename);
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(a.mimeType || '') ? a.mimeType : 'application/octet-stream';
    parts.push(`--${mixed}`, `Content-Type: ${type}; ${p.name}`, `Content-Disposition: attachment; ${p.disposition}`, 'Content-Transfer-Encoding: base64', '', wrap76(a.data.toString('base64')));
  }
  parts.push(`--${mixed}--`);
  return [...headers, `Content-Type: multipart/mixed; boundary="${mixed}"`, '', ...parts, ''].join('\r\n');
}

/* ---------------- token encryption ---------------- */

function tokenKey() {
  const secret = env('MAIL_TOKEN_SECRET') || env('GOOGLE_CLIENT_SECRET') || env('MICROSOFT_CLIENT_SECRET');
  if (!secret) throw new MailError('Mail token encryption is not configured (set MAIL_TOKEN_SECRET).', 503);
  const label = env('MAIL_TOKEN_SECRET') ? 'toolbox-mail-token-v1' : 'toolbox-mail-token-derived-v1';
  return crypto.createHash('sha256').update(`${label}:${secret}`).digest();
}

export function encryptTokens(tokens, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`;
}

export function decryptTokens(blob, aad) {
  const [v, iv, tag, ct] = String(blob || '').split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new MailError('Stored mailbox credentials are unreadable. Reconnect the account.', 401, 'reauth');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8'));
  } catch {
    throw new MailError('Stored mailbox credentials could not be decrypted (was MAIL_TOKEN_SECRET changed?). Reconnect the account.', 401, 'reauth');
  }
}

const aadFor = (userId, provider, email) => `${userId}:${provider}:${String(email).toLowerCase()}`;

/* ---------------- account store ---------------- */

const LEGACY_FILE = () => path.join(process.cwd(), '.toolbox-mail.json');
const FILE_STORE = () => path.join(process.cwd(), '.toolbox-mail-accounts.json');
const accountCache = new Map(); // userId → { at, accounts }
const CACHE_MS = 30_000;

function supabaseRest() {
  const url = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url, key } : null;
}

function readJsonFile(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function writeJsonFile(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 }); }

/** Plaintext accounts left by the previous implementation (.toolbox-mail.json). */
function legacyAccounts(userId) {
  const record = readJsonFile(LEGACY_FILE())[userId];
  if (!record) return [];
  const list = Array.isArray(record.accounts) ? record.accounts : (record.access_token ? [{ ...record, provider: 'google' }] : []);
  return list.filter(a => a?.email && a.access_token).map(a => ({
    provider: a.provider === 'microsoft' ? 'microsoft' : 'google', email: a.email,
    tokens: { access_token: a.access_token, refresh_token: a.refresh_token || '', expires_at: a.expires_at || 0 },
  }));
}
function dropLegacy(userId) {
  const all = readJsonFile(LEGACY_FILE());
  if (!all[userId]) return;
  delete all[userId];
  try { writeJsonFile(LEGACY_FILE(), all); } catch { /* read-only disk */ }
}

class MissingTableError extends Error {}

async function sbRequest(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const sb = supabaseRest();
  const res = await fetch(`${sb.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 404 || err.code === '42P01' || err.code === 'PGRST205') throw new MissingTableError(err.message || 'mail_accounts table missing');
    throw new MailError(`Mail account storage failed: ${err.message || res.status}`, 502);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

let warnedMissingTable = false;
function warnMissingTable() {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.warn('[mail] Supabase table public.mail_accounts is missing — run supabase/mail_accounts.sql. Falling back to the local file store.');
}

const fileStore = {
  list(userId) {
    const rows = readJsonFile(FILE_STORE())[userId] || [];
    return rows.map(r => ({ provider: r.provider, email: r.email, tokens: decryptTokens(r.token_blob, aadFor(userId, r.provider, r.email)), updated_at: r.updated_at }));
  },
  upsert(userId, account) {
    const all = readJsonFile(FILE_STORE());
    const rows = (all[userId] || []).filter(r => !(r.provider === account.provider && r.email.toLowerCase() === account.email.toLowerCase()));
    rows.push({ provider: account.provider, email: account.email, token_blob: encryptTokens(account.tokens, aadFor(userId, account.provider, account.email)), updated_at: new Date().toISOString() });
    all[userId] = rows;
    writeJsonFile(FILE_STORE(), all);
  },
  remove(userId, provider, email) {
    const all = readJsonFile(FILE_STORE());
    all[userId] = (all[userId] || []).filter(r => !(r.provider === provider && r.email.toLowerCase() === email.toLowerCase()));
    writeJsonFile(FILE_STORE(), all);
  },
};

const supabaseStore = {
  async list(userId) {
    const rows = await sbRequest(`mail_accounts?user_id=eq.${encodeURIComponent(userId)}&select=provider,email,token_blob,updated_at&order=created_at.asc`);
    return (rows || []).map(r => ({ provider: r.provider, email: r.email, tokens: decryptTokens(r.token_blob, aadFor(userId, r.provider, r.email)), updated_at: r.updated_at }));
  },
  async upsert(userId, account) {
    await sbRequest('mail_accounts?on_conflict=user_id,provider,email', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{ user_id: userId, provider: account.provider, email: account.email, token_blob: encryptTokens(account.tokens, aadFor(userId, account.provider, account.email)), updated_at: new Date().toISOString() }],
    });
  },
  async remove(userId, provider, email) {
    await sbRequest(`mail_accounts?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${encodeURIComponent(provider)}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
};

async function withStore(fn) {
  if (supabaseRest()) {
    try { return await fn(supabaseStore, 'supabase'); }
    catch (e) { if (!(e instanceof MissingTableError)) throw e; warnMissingTable(); }
  }
  return fn(fileStore, 'file');
}

export function storageMode() { return supabaseRest() ? 'supabase' : 'file'; }

const withId = (a) => ({ ...a, id: `${a.provider}:${a.email}` });

export async function listAccounts(userId, { fresh = false } = {}) {
  const cached = accountCache.get(userId);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.accounts;
  let accounts = await withStore(store => store.list(userId));
  if (!accounts.length) {
    const legacy = legacyAccounts(userId);
    if (legacy.length) {
      for (const a of legacy) await withStore(store => store.upsert(userId, a));
      dropLegacy(userId);
      accounts = legacy;
    }
  }
  accounts = accounts.map(withId);
  accountCache.set(userId, { at: Date.now(), accounts });
  return accounts;
}

export async function saveAccount(userId, account) {
  await withStore(store => store.upsert(userId, account));
  accountCache.delete(userId);
}

export async function removeAccount(userId, provider, email) {
  await withStore(store => store.remove(userId, provider, email));
  accountCache.delete(userId);
}

/* ---------------- auth ---------------- */

const authCache = new Map(); // bearer → { user, exp }

async function authenticate(request) {
  const url = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
  const authorization = String(request.headers.authorization || '');
  if (!url || !key) throw new MailError('Toolbox sign-in is not configured on this deployment.', 503);
  if (!/^Bearer [\w.-]+$/.test(authorization)) throw new MailError('Sign in to Toolbox to use Mail.', 401, 'signin');
  const hit = authCache.get(authorization);
  if (hit && hit.exp > Date.now()) return hit.user;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new MailError('Your Toolbox session has expired. Sign in again.', 401, 'signin');
  const user = await res.json();
  if (!user?.id) throw new MailError('A signed-in Toolbox account is required.', 401, 'signin');
  if (authCache.size > 500) authCache.clear();
  authCache.set(authorization, { user, exp: Date.now() + 60_000 });
  return user;
}

/* ---------------- provider tokens ---------------- */

function providerCreds(provider) {
  return provider === 'microsoft'
    ? { id: env('MICROSOFT_CLIENT_ID'), secret: env('MICROSOFT_CLIENT_SECRET'), tokenUrl: MS_TOKEN_URL }
    : { id: env('GOOGLE_CLIENT_ID'), secret: env('GOOGLE_CLIENT_SECRET'), tokenUrl: GOOGLE_TOKEN_URL };
}

const refreshing = new Map();

async function refreshAccount(userId, account) {
  const key = `${userId}:${account.id}`;
  if (refreshing.has(key)) return refreshing.get(key);
  const job = (async () => {
    if (!account.tokens.refresh_token) throw new MailError(`Access to ${account.email} expired. Reconnect the account.`, 401, 'reauth');
    const creds = providerCreds(account.provider);
    const res = await fetch(creds.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.id, client_secret: creds.secret, refresh_token: account.tokens.refresh_token, grant_type: 'refresh_token',
        ...(account.provider === 'microsoft' ? { scope: MS_SCOPE } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new MailError(`Access to ${account.email} was revoked or expired. Reconnect the account.`, 401, 'reauth');
    }
    account.tokens = {
      ...account.tokens,
      access_token: data.access_token,
      refresh_token: data.refresh_token || account.tokens.refresh_token,
      expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
    await saveAccount(userId, account);
    return account;
  })();
  refreshing.set(key, job);
  try { return await job; } finally { refreshing.delete(key); }
}

/** A provider API client bound to one account; refreshes tokens transparently. */
function client(userId, account) {
  const call = async (url, opts = {}, retried = false) => {
    if (!account.tokens.access_token || (account.tokens.expires_at && account.tokens.expires_at < Date.now() + 60_000)) {
      if (account.tokens.refresh_token) await refreshAccount(userId, account);
    }
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${account.tokens.access_token}`, ...(opts.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
      ...(opts.json !== undefined ? { body: JSON.stringify(opts.json) } : {}),
      signal: AbortSignal.timeout(opts.timeout || 30000),
    });
    if (res.status === 401 && !retried && account.tokens.refresh_token) {
      account.tokens.expires_at = 0;
      await refreshAccount(userId, account);
      return call(url, opts, true);
    }
    return res;
  };
  const json = async (url, opts = {}) => {
    const res = await call(url, opts);
    if (res.status === 204 || res.status === 202) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || data.error_description || (typeof data.error === 'string' ? data.error : '') || `${account.provider === 'microsoft' ? 'Microsoft' : 'Gmail'} request failed (${res.status}).`;
      throw new MailError(msg, res.status === 404 ? 404 : res.status === 401 ? 401 : res.status === 429 ? 429 : 502, res.status === 401 ? 'reauth' : '');
    }
    return data;
  };
  return { call, json, account };
}

/* =================================================================
   Gmail
   ================================================================= */

const headerMap = (headers = []) => Object.fromEntries(headers.map(h => [String(h.name).toLowerCase(), h.value]));
const b64urlToBuffer = (s) => Buffer.from(String(s || ''), 'base64url');

function decodeBody(data, contentType = '') {
  const buf = b64urlToBuffer(data);
  const charset = (/charset="?([\w-]+)"?/i.exec(contentType)?.[1] || 'utf-8').toLowerCase();
  try { return new TextDecoder(charset).decode(buf); } catch { return buf.toString('utf8'); }
}

const GMAIL_SYSTEM = [
  { id: 'INBOX', role: 'inbox', name: 'Inbox' },
  { id: 'STARRED', role: 'starred', name: 'Starred' },
  { id: 'IMPORTANT', role: 'important', name: 'Important' },
  { id: 'SENT', role: 'sent', name: 'Sent' },
  { id: 'DRAFT', role: 'drafts', name: 'Drafts' },
  { id: 'ALL', role: 'all', name: 'All mail' },
  { id: 'SPAM', role: 'spam', name: 'Spam' },
  { id: 'TRASH', role: 'trash', name: 'Trash' },
];

function gmailSummary(m) {
  const h = headerMap(m.payload?.headers);
  const labels = m.labelIds || [];
  return {
    id: m.id,
    threadId: m.threadId,
    from: parseAddress(h.from || ''),
    to: parseAddressList(h.to || ''),
    subject: h.subject || '',
    snippet: decodeEntities(m.snippet || ''),
    date: new Date(Number(m.internalDate) || Date.parse(h.date) || Date.now()).toISOString(),
    unread: labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
    important: labels.includes('IMPORTANT'),
    draft: labels.includes('DRAFT'),
    hasAttachments: /multipart\/mixed/i.test(h['content-type'] || ''),
    labels: labels.filter(l => /^Label_/.test(l)),
    folderIds: labels,
  };
}

const META = ['From', 'To', 'Subject', 'Date', 'Content-Type'].map(h => `metadataHeaders=${h}`).join('&');

const gmail = {
  async folders(c) {
    const { labels = [] } = await c.json(`${GMAIL}/labels`);
    const user = labels.filter(l => l.type === 'user' && l.labelListVisibility !== 'labelHide');
    const want = [...GMAIL_SYSTEM.filter(s => s.id !== 'ALL').map(s => s.id), ...user.map(l => l.id)];
    const details = await mapLimit(want, 8, id => c.json(`${GMAIL}/labels/${encodeURIComponent(id)}`).catch(() => null));
    const byId = new Map(details.filter(Boolean).map(d => [d.id, d]));
    const system = GMAIL_SYSTEM.map(s => {
      const d = byId.get(s.id);
      const unread = s.role === 'drafts' ? 0 : (s.role === 'sent' || s.role === 'trash' || s.role === 'all' ? 0 : d?.messagesUnread || 0);
      return { id: s.id, name: s.name, role: s.role, unread, total: s.role === 'drafts' ? d?.messagesTotal || 0 : d?.messagesTotal ?? null, system: true };
    });
    const custom = user.map(l => {
      const d = byId.get(l.id) || l;
      return { id: l.id, name: l.name, role: 'label', unread: d.messagesUnread || 0, total: d.messagesTotal ?? null, color: l.color?.backgroundColor || null, system: false };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return [...system, ...custom];
  },

  async list(c, { folder, q, pageToken, limit, threads }) {
    const params = new URLSearchParams({ maxResults: String(limit) });
    if (folder && folder !== 'ALL') params.append('labelIds', folder);
    if (q) params.set('q', q);
    if (pageToken) params.set('pageToken', pageToken);
    if (folder === 'SPAM' || folder === 'TRASH') params.set('includeSpamTrash', 'true');
    if (threads) {
      const data = await c.json(`${GMAIL}/threads?${params}`);
      const items = await mapLimit(data.threads || [], 8, t => c.json(`${GMAIL}/threads/${t.id}?format=metadata&${META}`).catch(() => null));
      const messages = items.filter(Boolean).map(t => {
        const all = (t.messages || []).map(gmailSummary);
        const inFolder = folder && folder !== 'ALL' ? all.filter(m => m.folderIds.includes(folder)) : all;
        const last = (inFolder.length ? inFolder : all).at(-1);
        if (!last) return null;
        const senders = [...new Map(all.map(m => [m.from.email, m.from])).values()];
        return { ...last, id: last.id, threadId: t.id, threadCount: all.length, unread: all.some(m => m.unread), starred: all.some(m => m.starred), hasAttachments: all.some(m => m.hasAttachments), participants: senders.slice(-3) };
      }).filter(Boolean);
      return { messages, nextPageToken: data.nextPageToken || null, resultSizeEstimate: data.resultSizeEstimate ?? null };
    }
    const data = await c.json(`${GMAIL}/messages?${params}`);
    const items = await mapLimit(data.messages || [], 10, m => c.json(`${GMAIL}/messages/${m.id}?format=metadata&${META}`).catch(() => null));
    return { messages: items.filter(Boolean).map(gmailSummary), nextPageToken: data.nextPageToken || null, resultSizeEstimate: data.resultSizeEstimate ?? null };
  },

  async parseFull(c, m, budget) {
    const h = headerMap(m.payload?.headers);
    let html = '', text = '';
    const attachments = [];
    const pendingBodies = [];
    const walk = (part) => {
      if (!part) return;
      const mime = String(part.mimeType || '').toLowerCase();
      const ph = headerMap(part.headers);
      const disposition = ph['content-disposition'] || '';
      const contentId = String(ph['content-id'] || ph['x-attachment-id'] || '').replace(/[<>]/g, '');
      const isFile = !mime.startsWith('multipart/') && (part.filename || /attachment/i.test(disposition) || (contentId && !mime.startsWith('text/')));
      if (isFile) {
        attachments.push({
          id: part.body?.attachmentId || `part:${part.partId}`,
          filename: part.filename || (contentId ? `${contentId}.${mime.split('/')[1] || 'bin'}` : 'attachment'),
          mimeType: mime || 'application/octet-stream',
          size: part.body?.size || 0,
          contentId: contentId || null,
          inline: /inline/i.test(disposition) || (!!contentId && !part.filename),
          _data: part.body?.data || null,
        });
        return;
      }
      if (mime === 'text/html' && !html) {
        if (part.body?.data) html = decodeBody(part.body.data, ph['content-type']);
        else if (part.body?.attachmentId) pendingBodies.push({ kind: 'html', id: part.body.attachmentId, ct: ph['content-type'] });
      } else if (mime === 'text/plain' && !text) {
        if (part.body?.data) text = decodeBody(part.body.data, ph['content-type']);
        else if (part.body?.attachmentId) pendingBodies.push({ kind: 'text', id: part.body.attachmentId, ct: ph['content-type'] });
      }
      (part.parts || []).forEach(walk);
    };
    walk(m.payload);
    for (const p of pendingBodies) {
      const d = await c.json(`${GMAIL}/messages/${m.id}/attachments/${encodeURIComponent(p.id)}`).catch(() => null);
      if (d?.data) { if (p.kind === 'html' && !html) html = decodeBody(d.data, p.ct); if (p.kind === 'text' && !text) text = decodeBody(d.data, p.ct); }
    }
    // Inline cid: images become data: URLs so the sandboxed frame can show them.
    if (html && /cid:/i.test(html)) {
      for (const a of attachments) {
        if (!a.contentId || !a.mimeType.startsWith('image/') || !html.includes(`cid:${a.contentId}`)) continue;
        if (budget.left < (a.size || 0)) continue;
        let data = a._data;
        if (!data && !a.id.startsWith('part:')) data = (await c.json(`${GMAIL}/messages/${m.id}/attachments/${encodeURIComponent(a.id)}`).catch(() => null))?.data;
        if (!data) continue;
        budget.left -= a.size || 0;
        const b64 = b64urlToBuffer(data).toString('base64');
        html = html.split(`cid:${a.contentId}`).join(`data:${a.mimeType};base64,${b64}`);
        a.inline = true; a.embedded = true;
      }
    }
    const labels = m.labelIds || [];
    return {
      ...gmailSummary(m),
      cc: parseAddressList(h.cc || ''),
      bcc: parseAddressList(h.bcc || ''),
      replyTo: parseAddressList(h['reply-to'] || ''),
      messageId: h['message-id'] || '',
      references: h.references || '',
      inReplyTo: h['in-reply-to'] || '',
      listUnsubscribe: h['list-unsubscribe'] || '',
      html, text,
      attachments: attachments.map(({ _data, ...a }) => a),
      hasAttachments: attachments.some(a => !a.embedded),
      starred: labels.includes('STARRED'),
    };
  },

  async message(c, id) {
    const m = await c.json(`${GMAIL}/messages/${encodeURIComponent(id)}?format=full`);
    return gmail.parseFull(c, m, { left: INLINE_IMAGE_BUDGET });
  },

  async thread(c, id) {
    const t = await c.json(`${GMAIL}/threads/${encodeURIComponent(id)}?format=full`);
    const budget = { left: INLINE_IMAGE_BUDGET };
    const messages = [];
    for (const m of t.messages || []) messages.push(await gmail.parseFull(c, m, budget));
    return { id: t.id, subject: messages[0]?.subject || '', messages };
  },

  async attachment(c, messageId, id) {
    if (id.startsWith('part:')) {
      const m = await c.json(`${GMAIL}/messages/${encodeURIComponent(messageId)}?format=full`);
      const partId = id.slice(5);
      let found = null;
      const walk = (p) => { if (!p || found) return; if (p.partId === partId) found = p; (p.parts || []).forEach(walk); };
      walk(m.payload);
      if (!found?.body?.data) throw new MailError('Attachment not found.', 404);
      return b64urlToBuffer(found.body.data);
    }
    const d = await c.json(`${GMAIL}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(id)}`, { timeout: 60000 });
    return b64urlToBuffer(d.data);
  },

  async send(c, msg) {
    const attachments = [];
    for (const a of msg.attachments) {
      if (a.data) attachments.push(a);
      else if (a.messageId && a.attachmentId) attachments.push({ ...a, data: await gmail.attachment(c, a.messageId, a.attachmentId) });
    }
    const raw = buildMime({ ...msg, from: { name: msg.fromName || '', email: c.account.email }, attachments });
    const threadId = msg.threadId || undefined;
    if (raw.length < 4.5 * 1024 * 1024) {
      const r = await c.json(`${GMAIL}/messages/send`, { method: 'POST', json: { raw: Buffer.from(raw).toString('base64url'), ...(threadId ? { threadId } : {}) }, timeout: 60000 });
      return { id: r.id, threadId: r.threadId };
    }
    const boundary = `up_${crypto.randomBytes(10).toString('hex')}`;
    const body = [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(threadId ? { threadId } : {}), `--${boundary}`, 'Content-Type: message/rfc822', '', raw, `--${boundary}--`, ''].join('\r\n');
    const r = await c.json(`https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body, timeout: 120000,
    });
    return { id: r.id, threadId: r.threadId };
  },

  async action(c, { action, ids, scope, folder, from, add = [], remove = [], value }) {
    const kind = scope === 'thread' ? 'threads' : 'messages';
    const modify = (addLabelIds, removeLabelIds) => {
      if (kind === 'messages' && ids.length > 1) {
        return c.json(`${GMAIL}/messages/batchModify`, { method: 'POST', json: { ids, addLabelIds, removeLabelIds } }).then(() => ids.map(id => ({ id })));
      }
      return mapLimit(ids, 6, id => c.json(`${GMAIL}/${kind}/${encodeURIComponent(id)}/modify`, { method: 'POST', json: { addLabelIds, removeLabelIds } }).then(() => ({ id })));
    };
    const each = (verb) => mapLimit(ids, 6, id => c.json(`${GMAIL}/${kind}/${encodeURIComponent(id)}/${verb}`, { method: 'POST', json: {} }).then(() => ({ id })));
    const sysLabel = (f) => f && f !== 'ALL' && f !== 'STARRED' && f !== 'IMPORTANT' && f !== 'DRAFT' ? f : null;
    switch (action) {
      case 'read': return modify([], ['UNREAD']);
      case 'unread': return modify(['UNREAD'], []);
      case 'star': return modify(['STARRED'], []);
      case 'unstar': return modify([], ['STARRED']);
      case 'archive': return modify([], ['INBOX']);
      case 'trash': return each('trash');
      case 'untrash': return each('untrash');
      case 'spam': return modify(['SPAM'], ['INBOX']);
      case 'notspam': return modify(['INBOX'], ['SPAM']);
      case 'move': {
        if (folder === 'TRASH') return each('trash');
        const target = sysLabel(folder);
        const src = sysLabel(from);
        return modify(target ? [target] : [], src && src !== target ? [src] : (target === 'INBOX' ? [] : ['INBOX']));
      }
      case 'label': return modify(add, remove);
      case 'restore': {
        if (value === 'trash') await each('untrash');
        const target = sysLabel(folder);
        if (target && target !== 'TRASH') await modify([target], value === 'spam' ? ['SPAM'] : []);
        return ids.map(id => ({ id }));
      }
      default: throw new MailError(`Unknown action "${action}".`, 400);
    }
  },
};

/* =================================================================
   Microsoft Graph
   ================================================================= */

const MS_WELL_KNOWN = [
  { id: 'inbox', role: 'inbox', name: 'Inbox' },
  { id: 'flagged', role: 'starred', name: 'Flagged', virtual: true },
  { id: 'sentitems', role: 'sent', name: 'Sent' },
  { id: 'drafts', role: 'drafts', name: 'Drafts' },
  { id: 'archive', role: 'archive', name: 'Archive' },
  { id: 'junkemail', role: 'spam', name: 'Junk' },
  { id: 'deleteditems', role: 'trash', name: 'Deleted' },
];
const MS_SELECT = 'id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead,isDraft,flag,hasAttachments,importance,parentFolderId';
const msAddr = (r) => ({ name: r?.emailAddress?.name || '', email: r?.emailAddress?.address || '' });

function msSummary(m) {
  return {
    id: m.id,
    threadId: m.conversationId || m.id,
    from: msAddr(m.from || m.sender),
    to: (m.toRecipients || []).map(msAddr),
    subject: m.subject || '',
    snippet: m.bodyPreview || '',
    date: m.receivedDateTime || m.sentDateTime || new Date().toISOString(),
    unread: m.isRead === false,
    starred: m.flag?.flagStatus === 'flagged',
    important: m.importance === 'high',
    draft: !!m.isDraft,
    hasAttachments: !!m.hasAttachments,
    labels: [],
    folderIds: m.parentFolderId ? [m.parentFolderId] : [],
  };
}

const encodeLink = (link) => Buffer.from(link).toString('base64url');
function decodeLink(token) {
  const link = Buffer.from(String(token), 'base64url').toString('utf8');
  if (!link.startsWith(`${GRAPH}/`)) throw new MailError('Invalid page token.', 400);
  return link;
}
const msFolderPath = (folder) => folder === 'flagged' || !folder ? `${GRAPH}/messages` : `${GRAPH}/mailFolders/${encodeURIComponent(folder)}/messages`;

const microsoft = {
  async folders(c) {
    const [list, ...known] = await Promise.all([
      c.json(`${GRAPH}/mailFolders?$top=100&$select=id,displayName,unreadItemCount,totalItemCount`),
      ...MS_WELL_KNOWN.filter(w => !w.virtual).map(w => c.json(`${GRAPH}/mailFolders/${w.id}?$select=id,unreadItemCount,totalItemCount`).catch(() => null)),
    ]);
    const knownIds = new Map();
    MS_WELL_KNOWN.filter(w => !w.virtual).forEach((w, i) => { if (known[i]) knownIds.set(known[i].id, { ...w, data: known[i] }); });
    const system = MS_WELL_KNOWN.map(w => {
      if (w.virtual) return { id: w.id, name: w.name, role: w.role, unread: 0, total: null, system: true };
      const entry = [...knownIds.values()].find(k => k.id === w.id);
      if (!entry) return null;
      const counts = entry.data;
      return { id: w.id, name: w.name, role: w.role, unread: ['sent', 'drafts', 'trash'].includes(w.role) ? 0 : counts.unreadItemCount || 0, total: counts.totalItemCount ?? null, system: true, nativeId: counts.id };
    }).filter(Boolean);
    const skip = new Set(['Outbox', 'Conversation History', 'Sync Issues', 'RSS Feeds', 'RSS Subscriptions']);
    const custom = (list.value || []).filter(f => !knownIds.has(f.id) && !skip.has(f.displayName)).map(f => ({
      id: f.id, name: f.displayName, role: 'label', unread: f.unreadItemCount || 0, total: f.totalItemCount ?? null, system: false,
    })).sort((a, b) => a.name.localeCompare(b.name));
    return [...system, ...custom];
  },

  async list(c, { folder, q, pageToken, limit }) {
    let url;
    if (pageToken) url = decodeLink(pageToken);
    else {
      const params = new URLSearchParams({ $top: String(limit), $select: MS_SELECT });
      if (q) params.set('$search', `"${q.replace(/"/g, '')}"`);
      else params.set('$orderby', 'receivedDateTime desc');
      if (folder === 'flagged') params.set('$filter', "flag/flagStatus eq 'flagged'");
      if (folder === 'flagged' && !q) params.delete('$orderby');
      url = `${msFolderPath(folder)}?${params}`;
    }
    const data = await c.json(url, { headers: { Prefer: 'outlook.body-content-type="html"' } });
    const messages = (data.value || []).map(msSummary);
    if (folder === 'flagged') messages.sort((a, b) => b.date.localeCompare(a.date));
    return { messages, nextPageToken: data['@odata.nextLink'] ? encodeLink(data['@odata.nextLink']) : null, resultSizeEstimate: null };
  },

  async full(c, m, budget) {
    let html = m.body?.contentType === 'html' ? m.body.content || '' : '';
    const text = m.body?.contentType === 'text' ? m.body.content || '' : '';
    let attachments = [];
    if (m.hasAttachments || /cid:/i.test(html)) {
      const data = await c.json(`${GRAPH}/messages/${encodeURIComponent(m.id)}/attachments`).catch(() => ({ value: [] }));
      attachments = (data.value || []).map(a => {
        const item = { id: a.id, filename: a.name || 'attachment', mimeType: a.contentType || 'application/octet-stream', size: a.size || 0, contentId: a.contentId || null, inline: !!a.isInline };
        if (html && a.contentId && a.contentBytes && html.includes(`cid:${a.contentId}`) && budget.left >= a.size) {
          budget.left -= a.size;
          html = html.split(`cid:${a.contentId}`).join(`data:${item.mimeType};base64,${a.contentBytes}`);
          item.embedded = true; item.inline = true;
        }
        return item;
      });
    }
    return {
      ...msSummary(m),
      cc: (m.ccRecipients || []).map(msAddr),
      bcc: (m.bccRecipients || []).map(msAddr),
      replyTo: (m.replyTo || []).map(msAddr),
      messageId: m.internetMessageId || '',
      references: '',
      inReplyTo: '',
      listUnsubscribe: '',
      html, text,
      attachments,
      hasAttachments: attachments.some(a => !a.embedded),
    };
  },

  async message(c, id) {
    const m = await c.json(`${GRAPH}/messages/${encodeURIComponent(id)}?$select=${MS_SELECT},bccRecipients,replyTo,body,internetMessageId`);
    return microsoft.full(c, m, { left: INLINE_IMAGE_BUDGET });
  },

  async thread(c, id) {
    const filter = `conversationId eq '${String(id).replace(/'/g, "''")}'`;
    const data = await c.json(`${GRAPH}/messages?$filter=${encodeURIComponent(filter)}&$top=50&$select=${MS_SELECT},bccRecipients,replyTo,body,internetMessageId`);
    const sorted = (data.value || []).sort((a, b) => String(a.receivedDateTime).localeCompare(String(b.receivedDateTime)));
    const budget = { left: INLINE_IMAGE_BUDGET };
    const messages = [];
    for (const m of sorted) messages.push(await microsoft.full(c, m, budget));
    return { id, subject: messages[0]?.subject || '', messages };
  },

  async attachment(c, messageId, id) {
    const res = await c.call(`${GRAPH}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(id)}/$value`, { timeout: 60000 });
    if (!res.ok) throw new MailError('Attachment not found.', res.status === 404 ? 404 : 502);
    return Buffer.from(await res.arrayBuffer());
  },

  async send(c, msg) {
    const rec = (list) => list.map(a => ({ emailAddress: { address: a.email, ...(a.name ? { name: a.name } : {}) } }));
    const files = msg.attachments.filter(a => a.data);
    if (files.some(a => a.data.length > 3 * 1024 * 1024)) throw new MailError('Microsoft accounts accept attachments up to 3 MB each from Toolbox.', 413);
    const fileAttachments = files.map(a => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename || 'attachment', contentType: a.mimeType || 'application/octet-stream', contentBytes: a.data.toString('base64') }));
    const body = { contentType: 'HTML', content: msg.html || `<div>${String(msg.text || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])).replace(/\n/g, '<br>')}</div>` };
    if (msg.replyToId && ['reply', 'replyAll', 'forward'].includes(msg.mode)) {
      const verb = msg.mode === 'replyAll' ? 'createReplyAll' : msg.mode === 'forward' ? 'createForward' : 'createReply';
      const draft = await c.json(`${GRAPH}/messages/${encodeURIComponent(msg.replyToId)}/${verb}`, { method: 'POST', json: {} });
      await c.json(`${GRAPH}/messages/${encodeURIComponent(draft.id)}`, { method: 'PATCH', json: { subject: msg.subject, body, toRecipients: rec(msg.to), ccRecipients: rec(msg.cc), bccRecipients: rec(msg.bcc) } });
      for (const a of fileAttachments) await c.json(`${GRAPH}/messages/${encodeURIComponent(draft.id)}/attachments`, { method: 'POST', json: a });
      await c.json(`${GRAPH}/messages/${encodeURIComponent(draft.id)}/send`, { method: 'POST', json: {} });
      return { id: draft.id, threadId: draft.conversationId || null };
    }
    await c.json(`${GRAPH}/sendMail`, {
      method: 'POST', timeout: 60000,
      json: { message: { subject: msg.subject, body, toRecipients: rec(msg.to), ccRecipients: rec(msg.cc), bccRecipients: rec(msg.bcc), ...(fileAttachments.length ? { attachments: fileAttachments } : {}) }, saveToSentItems: true },
    });
    return { id: null, threadId: null };
  },

  async action(c, { action, ids, folder, value }) {
    const patch = (json) => mapLimit(ids, 5, id => c.json(`${GRAPH}/messages/${encodeURIComponent(id)}`, { method: 'PATCH', json }).then(() => ({ id })));
    const move = (destinationId) => mapLimit(ids, 5, id => c.json(`${GRAPH}/messages/${encodeURIComponent(id)}/move`, { method: 'POST', json: { destinationId } }).then(r => ({ id, newId: r.id || id })));
    switch (action) {
      case 'read': return patch({ isRead: true });
      case 'unread': return patch({ isRead: false });
      case 'star': return patch({ flag: { flagStatus: 'flagged' } });
      case 'unstar': return patch({ flag: { flagStatus: 'notFlagged' } });
      case 'archive': return move('archive');
      case 'trash': return move('deleteditems');
      case 'spam': return move('junkemail');
      case 'notspam': case 'untrash': return move('inbox');
      case 'move': case 'restore': {
        const dest = folder === 'TRASH' || folder === 'trash' ? 'deleteditems' : (!folder || folder === 'flagged' ? 'inbox' : folder);
        return move(dest);
      }
      case 'label': throw new MailError('Labels are not supported for Microsoft accounts. Move the message to a folder instead.', 400);
      default: throw new MailError(`Unknown action "${action}".`, 400);
    }
  },
};

const PROVIDERS = { google: gmail, microsoft };

/* =================================================================
   Request routing
   ================================================================= */

function pickAccount(accounts, accountId) {
  if (!accounts.length) throw new MailError('No mailbox is connected. Connect Gmail or Microsoft first.', 404, 'noaccount');
  if (!accountId) return accounts[0];
  const hit = accounts.find(a => a.id === accountId);
  if (!hit) throw new MailError('That mailbox is not connected to your Toolbox account.', 404, 'noaccount');
  return hit;
}

async function forAccount(user, accountId) {
  const accounts = await listAccounts(user.id);
  const account = pickAccount(accounts, accountId);
  // Copy so concurrent requests refresh tokens on their own object but save through the store.
  const copy = { ...account, tokens: { ...account.tokens } };
  return { c: client(user.id, copy), api: PROVIDERS[copy.provider] || gmail, account: copy };
}

const clampLimit = (v) => Math.max(1, Math.min(PAGE_MAX, Number(v) || PAGE_DEFAULT));

function decodeAttachments(list = []) {
  if (!Array.isArray(list)) throw new MailError('attachments must be an array.', 400);
  return list.slice(0, 40).map(a => {
    if (a?.messageId && a?.attachmentId) return { filename: cleanHeader(a.filename), mimeType: cleanHeader(a.mimeType), messageId: String(a.messageId), attachmentId: String(a.attachmentId) };
    const b64 = String(a?.data || '').replace(/^data:[^,]*,/, '');
    if (!b64) throw new MailError(`Attachment "${a?.filename || ''}" has no data.`, 400);
    return { filename: cleanHeader(a.filename || 'attachment'), mimeType: cleanHeader(a.mimeType || 'application/octet-stream'), data: Buffer.from(b64, 'base64') };
  });
}

async function oauthCallback(request, response, url) {
  const code = url.searchParams.get('code');
  const rawState = url.searchParams.get('state') || '';
  const unsignedProvider = (() => { try { return JSON.parse(Buffer.from(rawState.split('.')[0] || '', 'base64url').toString('utf8')).provider; } catch { return null; } })();
  const stateSecret = env('MAIL_OAUTH_STATE_SECRET') || (unsignedProvider === 'microsoft' ? env('MICROSOFT_CLIENT_SECRET') : env('GOOGLE_CLIENT_SECRET'));
  let state;
  try { state = stateSecret ? decodeMailState(rawState, stateSecret) : null; } catch { state = null; }
  const page = (status, title, message, script = '') => {
    response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    const safe = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    response.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(title)}</title><body style="font:15px/1.5 -apple-system,system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f7f6;color:#0a0a0a"><div style="max-width:360px;padding:24px;text-align:center"><h1 style="font-size:18px;margin:0 0 8px">${safe(title)}</h1><p style="margin:0;color:#525252">${safe(message)}</p></div>${script}</body>`);
  };
  const oauthError = url.searchParams.get('error');
  if (oauthError) { page(400, 'Mailbox not connected', url.searchParams.get('error_description') || 'Authorization was cancelled.'); return; }
  if (!code || !state?.userId) { page(400, 'Link expired', 'Invalid or expired mailbox authorization state. Close this window and try again.'); return; }
  const provider = state.provider === 'microsoft' ? 'microsoft' : 'google';
  try {
    const creds = providerCreds(provider);
    const redirect = mailCallbackUrl(request, provider === 'microsoft' ? env('MICROSOFT_REDIRECT_URI') : env('GOOGLE_REDIRECT_URI'));
    const tokenRes = await fetch(creds.tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: creds.id, client_secret: creds.secret, redirect_uri: redirect, ...(provider === 'microsoft' ? { scope: MS_SCOPE } : {}), grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(15000),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed.');
    const userRes = await fetch(provider === 'microsoft' ? `${GRAPH}` : 'https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` }, signal: AbortSignal.timeout(15000) });
    const userData = await userRes.json();
    const email = userData.mail || userData.userPrincipalName || userData.email;
    if (!email) throw new Error('The mail provider did not return an account email.');
    const previous = (await listAccounts(state.userId, { fresh: true }).catch(() => [])).find(a => a.provider === provider && a.email.toLowerCase() === email.toLowerCase());
    await saveAccount(state.userId, {
      provider, email: previous?.email || email,
      tokens: { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token || previous?.tokens?.refresh_token || '', expires_at: Date.now() + Number(tokenData.expires_in || 3600) * 1000 },
    });
    const accountId = `${provider}:${previous?.email || email}`;
    page(200, 'Mailbox connected', 'You can close this window.', `<script>window.opener?.postMessage({type:"toolbox:mail-oauth-success",accountId:${JSON.stringify(accountId).replace(/</g, '\\u003c')}}, ${JSON.stringify(state.appOrigin).replace(/</g, '\\u003c')}); window.close();</script>`);
  } catch (err) {
    page(500, 'Authentication failed', err.message);
  }
}

function oauthInit(request, response, url, user) {
  const provider = url.searchParams.get('provider') === 'microsoft' ? 'microsoft' : 'google';
  const creds = providerCreds(provider);
  const stateSecret = env('MAIL_OAUTH_STATE_SECRET') || creds.secret;
  const label = provider === 'microsoft' ? 'Microsoft' : 'Google';
  if (!creds.id || !creds.secret || !stateSecret) {
    return sendJson(response, 400, { success: false, error: provider === 'microsoft' ? 'Microsoft Mail is not configured on this deployment.' : 'Server is missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' });
  }
  const requestedOrigin = request.headers.origin || `${String(request.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${String(request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3000').split(',')[0]}`;
  const state = encodeMailState({ userId: user.id, provider, nonce: crypto.randomUUID(), expiresAt: Date.now() + 10 * 60 * 1000, appOrigin: requestedOrigin }, stateSecret);
  const loginHint = url.searchParams.get('hint') ? `&login_hint=${encodeURIComponent(url.searchParams.get('hint'))}` : '';
  if (provider === 'microsoft') {
    const redirect = mailCallbackUrl(request, env('MICROSOFT_REDIRECT_URI'));
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${creds.id}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&response_mode=query&scope=${encodeURIComponent(MS_SCOPE)}&state=${encodeURIComponent(state)}&prompt=select_account${loginHint}`;
    return sendJson(response, 200, { success: true, url: authUrl, provider });
  }
  const redirect = mailCallbackUrl(request, env('GOOGLE_REDIRECT_URI'));
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${creds.id}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(GOOGLE_SCOPE)}&access_type=offline&include_granted_scopes=true&prompt=consent&state=${encodeURIComponent(state)}${loginHint}`;
  void label;
  return sendJson(response, 200, { success: true, url: authUrl, provider });
}

function contentDisposition(filename, inline) {
  const f = String(filename || 'attachment').replace(/[\r\n"\\]/g, '_');
  const ascii = f.replace(/[^\x20-\x7e]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f)}`;
}

/**
 * Handles every /api/mail/* request. Returns true when the request was answered.
 */
export async function handleMail(request, response, url) {
  if (!url.pathname.startsWith('/api/mail/')) return false;
  const route = url.pathname.slice('/api/mail/'.length).replace(/\/$/, '');
  const method = request.method;

  if (route === 'oauth/callback' && method === 'GET') { await oauthCallback(request, response, url); return true; }

  try {
    const user = await authenticate(request);
    const q = url.searchParams;

    if (route === 'status' && method === 'GET') {
      const accounts = await listAccounts(user.id, { fresh: true });
      sendJson(response, 200, {
        success: true,
        configured: accounts.length > 0,
        email: accounts[0]?.email || null,
        activeAccountId: accounts[0]?.id || null,
        accounts: accounts.map(({ id, email, provider, updated_at }) => ({ id, email, provider, updatedAt: updated_at || null })),
        providersReady: { google: !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')), microsoft: !!(env('MICROSOFT_CLIENT_ID') && env('MICROSOFT_CLIENT_SECRET')) },
        storage: storageMode(),
      });
      return true;
    }

    if (route === 'oauth/init' && method === 'GET') { oauthInit(request, response, url, user); return true; }

    if (route === 'folders' && method === 'GET') {
      const { c, api, account } = await forAccount(user, q.get('accountId'));
      sendJson(response, 200, { success: true, accountId: account.id, provider: account.provider, folders: await api.folders(c) });
      return true;
    }

    if (route === 'messages' && method === 'GET') {
      const { c, api, account } = await forAccount(user, q.get('accountId'));
      const defaultFolder = account.provider === 'microsoft' ? 'inbox' : 'INBOX';
      const result = await api.list(c, {
        folder: q.get('folder') || (q.get('q') ? '' : defaultFolder),
        q: (q.get('q') || '').slice(0, 500),
        pageToken: q.get('pageToken') || '',
        limit: clampLimit(q.get('limit')),
        threads: q.get('threads') === '1' || q.get('threads') === 'true',
      });
      sendJson(response, 200, { success: true, accountId: account.id, ...result });
      return true;
    }

    if (route === 'message' && method === 'GET') {
      if (!q.get('id')) throw new MailError('id is required.', 400);
      const { c, api } = await forAccount(user, q.get('accountId'));
      sendJson(response, 200, { success: true, message: await api.message(c, q.get('id')) });
      return true;
    }

    if (route === 'thread' && method === 'GET') {
      if (!q.get('id')) throw new MailError('id is required.', 400);
      const { c, api } = await forAccount(user, q.get('accountId'));
      sendJson(response, 200, { success: true, thread: await api.thread(c, q.get('id')) });
      return true;
    }

    if (route === 'attachment' && method === 'GET') {
      const messageId = q.get('messageId'), id = q.get('id');
      if (!messageId || !id) throw new MailError('messageId and id are required.', 400);
      const { c, api } = await forAccount(user, q.get('accountId'));
      const data = await api.attachment(c, messageId, id);
      const mimeType = /^[\w.+-]+\/[\w.+-]+$/.test(q.get('mimeType') || '') ? q.get('mimeType') : 'application/octet-stream';
      response.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': data.length,
        'Content-Disposition': contentDisposition(q.get('filename'), q.get('inline') === '1'),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      });
      response.end(data);
      return true;
    }

    if (route === 'send' && method === 'POST') {
      const body = await readJsonBody(request);
      const { c, api } = await forAccount(user, body.accountId);
      const msg = {
        to: normalizeRecipients(body.to), cc: normalizeRecipients(body.cc), bcc: normalizeRecipients(body.bcc),
        subject: cleanHeader(body.subject || ''),
        html: String(body.html ?? body.body ?? ''), text: String(body.text || ''),
        inReplyTo: cleanHeader(body.inReplyTo || ''), references: cleanHeader(body.references || ''),
        threadId: body.threadId ? String(body.threadId) : '',
        replyToId: body.replyToId ? String(body.replyToId) : '',
        mode: ['reply', 'replyAll', 'forward'].includes(body.mode) ? body.mode : 'new',
        fromName: cleanHeader(body.fromName || ''),
        attachments: decodeAttachments(body.attachments),
      };
      if (!msg.to.length && !msg.cc.length && !msg.bcc.length) throw new MailError('Add at least one recipient.', 400);
      const result = await api.send(c, msg);
      sendJson(response, 200, { success: true, ...result });
      return true;
    }

    if (route === 'action' && method === 'POST') {
      const body = await readJsonBody(request);
      // Legacy shape: { action: 'send', message } and single { id, isRead | starred | folder }.
      if (body.action === 'send') {
        const m = body.message || {};
        const { c, api } = await forAccount(user, body.accountId);
        const result = await api.send(c, { to: normalizeRecipients(m.to), cc: normalizeRecipients(m.cc), bcc: normalizeRecipients(m.bcc), subject: cleanHeader(m.subject || ''), html: String(m.body || m.html || ''), text: '', inReplyTo: '', references: '', threadId: '', replyToId: '', mode: 'new', attachments: [] });
        sendJson(response, 200, { success: true, ...result });
        return true;
      }
      let action = String(body.action || '');
      if (action === 'read' && body.isRead === false) action = 'unread';
      if (action === 'read' && body.value === false) action = 'unread';
      if (action === 'star' && (body.starred === false || body.value === false)) action = 'unstar';
      const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean).map(String).slice(0, 500);
      if (!ids.length) throw new MailError('ids are required.', 400);
      const { c, api } = await forAccount(user, body.accountId);
      const results = await api.action(c, {
        action, ids, scope: body.scope === 'thread' ? 'thread' : 'message',
        folder: body.folder ? String(body.folder) : '', from: body.from ? String(body.from) : '',
        add: Array.isArray(body.add) ? body.add.map(String) : [], remove: Array.isArray(body.remove) ? body.remove.map(String) : [],
        value: body.value,
      });
      sendJson(response, 200, { success: true, results });
      return true;
    }

    if (route === 'disconnect' && method === 'POST') {
      const body = await readJsonBody(request);
      const accounts = await listAccounts(user.id, { fresh: true });
      const account = pickAccount(accounts, body.accountId);
      if (account.provider === 'google' && (account.tokens.refresh_token || account.tokens.access_token)) {
        fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.tokens.refresh_token || account.tokens.access_token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(8000) }).catch(() => {});
      }
      await removeAccount(user.id, account.provider, account.email);
      sendJson(response, 200, { success: true, removed: account.id });
      return true;
    }

    sendJson(response, 404, { success: false, error: 'Unknown mail endpoint.' });
    return true;
  } catch (error) {
    const status = error instanceof MailError ? error.status : 500;
    if (!(error instanceof MailError)) console.error('[mail]', error);
    if (!response.headersSent) sendJson(response, status, { success: false, error: error.message || 'Mail request failed.', code: error.code || undefined });
    else response.end();
    return true;
  }
}

export const __test = { buildMime, parseAddressList, normalizeRecipients, encryptTokens, decryptTokens, gmailSummary, msSummary, decodeEntities, htmlToText, accountCache, authCache };
