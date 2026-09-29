import { getCurrentUser, getSupabaseConfig } from './supabase.js';

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_TTL_HOURS = 24;
export const MESSAGE_FILE_LIMIT = 8 * 1024 * 1024;

function context() {
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to use Messages.');
  const { url, anonKey } = getSupabaseConfig();
  return { user, url, headers: { apikey: anonKey, Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' } };
}

async function request(path, options = {}) {
  const { user, url, headers } = context();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (getCurrentUser()?.id !== user.id) throw new Error('Your Messages account changed.');
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || `Messages request failed (${response.status}).`);
  if (response.status === 204) return null;
  return response.json();
}

export async function startDirectConversation(otherUserId) {
  const result = await request('rpc/get_or_create_direct_conversation', { method: 'POST', body: JSON.stringify({ other_user_id: otherUserId }) });
  return result;
}

export async function listConversations() {
  return request('rpc/list_my_conversations', { method: 'POST', body: '{}' });
}

export async function listConversationParticipants(conversationId) {
  return request('rpc/list_conversation_participants', { method: 'POST', body: JSON.stringify({ target_conversation_id: conversationId }) });
}

export async function approveParticipantRequest(requestMessageId) {
  return request('rpc/approve_conversation_participant', { method: 'POST', body: JSON.stringify({ request_message_id: requestMessageId }) });
}

export async function listMessages(conversationId) {
  const rows = await request(`toolbox_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=200`);
  return Array.isArray(rows) ? rows.reverse() : [];
}

export async function setMessageTyping(conversationId, typing) {
  return request('rpc/set_message_typing', { method: 'POST', body: JSON.stringify({ target_conversation_id: conversationId, is_typing: Boolean(typing) }) });
}

export async function listMessageTyping(conversationId) {
  return request(`toolbox_message_typing?conversation_id=eq.${encodeURIComponent(conversationId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id,expires_at&limit=100`);
}

export async function sendMessage(conversationId, body, kind = 'text', payload = {}) {
  const { user } = context();
  const text = String(body || '').trim();
  if (text.length > MESSAGE_MAX_LENGTH) throw new Error(`Messages can be up to ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`);
  if (!text && kind === 'text') throw new Error('Write a message first.');
  const rows = await request('toolbox_messages?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ conversation_id: conversationId, sender_id: user.id, body: text, kind, payload }) });
  return rows[0];
}

export async function updateMessagePayload(id, payload) {
  const rows = await request(`toolbox_messages?id=eq.${encodeURIComponent(id)}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ payload }) });
  // The database answers an update it refused with no rows, not an error: say so.
  if (!rows?.[0]) throw new Error('That change could not be saved. The chat may have expired, or Messages needs its latest database update (supabase/messaging.sql).');
  return rows[0];
}

/**
 * Records my vote on a poll (voting for my current choice takes it back). The server applies it
 * atomically, so votes cast at the same moment never overwrite each other. Resolves to the poll payload.
 */
export async function votePoll(messageId, optionIndex, current = null) {
  const { url, headers } = context();
  const response = await fetch(`${url}/rest/v1/rpc/vote_poll`, { method: 'POST', headers, body: JSON.stringify({ poll_message_id: messageId, option_index: optionIndex }) });
  if (response.ok) return response.json();
  const error = await response.json().catch(() => ({}));
  const missing = response.status === 404 || error.code === 'PGRST202';
  throw new Error(missing ? 'Poll voting needs the latest Messages database update.' : (error.message || `Your vote could not be saved (${response.status}).`));
}

export async function uploadMessageFile(file, conversationId) {
  if (!file || file.size > MESSAGE_FILE_LIMIT) throw new Error('Shared files must be 8 MB or smaller.');
  if (!/^[0-9a-f-]{36}$/i.test(conversationId || '')) throw new Error('Choose a conversation before sharing a file.');
  const { user, url, headers } = context();
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 140);
  // Documents, PDFs and text travel packed (lossless, fingerprint-checked); the recipient's
  // Toolbox unpacks them on download. Photos, video and archives go as they are.
  const { packForTransfer } = await import('./transfer-pack.js');
  const pack = await packForTransfer(file);
  if (getCurrentUser()?.id !== user.id) throw new Error('Your Messages account changed.');
  const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeName}${pack.packed ? '.kpk' : ''}`;
  const response = await fetch(`${url}/storage/v1/object/message-files/${path}`, { method: 'POST', headers: { apikey: headers.apikey, Authorization: headers.Authorization, 'Content-Type': pack.packed ? 'application/octet-stream' : (file.type || 'application/octet-stream'), 'x-upsert': 'false' }, body: pack.blob });
  if (getCurrentUser()?.id !== user.id) throw new Error('Your Messages account changed.');
  if (!response.ok) throw new Error('The file could not be uploaded.');
  return { name: file.name, size: file.size, type: file.type, storagePath: path, ...(pack.packed ? { packed: true, packedSize: pack.packedSize } : {}) };
}

/** Accept private references and trusted legacy Toolbox storage paths, never arbitrary URLs. */
export function messageFileLocation(payload, configUrl = getSupabaseConfig().url) {
  let bucket = 'message-files', path = payload?.storagePath;
  if (!path && payload?.url) {
    const source = new URL(payload.url), base = new URL(configUrl);
    if (source.origin !== base.origin || source.username || source.password) throw new Error('This attachment is not in Toolbox storage.');
    const match = source.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(toolbox-files|message-files)\/(.+)$/);
    if (!match) throw new Error('This attachment has no supported storage reference.');
    bucket = match[1]; path = decodeURIComponent(match[2]);
  }
  if (typeof path !== 'string' || !path || path.length > 500 || path.split('/').some(part => !part || part === '.' || part === '..') || /[\\?#\u0000-\u001f]/.test(path)) throw new Error('Invalid attachment storage reference.');
  return { bucket, path };
}

export async function loadMessageFile(payload) {
  const { user, url, headers } = context(), { bucket, path } = messageFileLocation(payload, url);
  const response = await fetch(`${url}/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers, body: JSON.stringify({ expiresIn: 60 }) });
  if (!response.ok) throw new Error('This attachment is unavailable, expired or not shared with you.');
  const data = await response.json();
  if (getCurrentUser()?.id !== user.id) throw new Error('Your Messages account changed.');
  const signedPath = data.signedURL || data.signedUrl || '';
  const signed = new URL(signedPath.startsWith('/object/') ? `/storage/v1${signedPath}` : signedPath, `${url}/storage/v1/`);
  if (signed.origin !== new URL(url).origin || !signed.pathname.startsWith('/storage/v1/object/sign/')) throw new Error('Invalid attachment download address.');
  let blob;
  if (payload.packed) blob = await (await import('./transfer-pack.js')).fetchTransfer(signed.href, { type: payload.type });
  else { const fileResponse = await fetch(signed.href, { referrerPolicy: 'no-referrer' }); if (!fileResponse.ok) throw new Error('The attachment could not be downloaded.'); blob = await fileResponse.blob(); }
  if (getCurrentUser()?.id !== user.id) throw new Error('Your Messages account changed.');
  return blob;
}

export async function listOnlineToolboxFiles() {
  return request('saved_artifacts?select=id,name,kind,storage_url,payload,updated_at&order=updated_at.desc&limit=50');
}
