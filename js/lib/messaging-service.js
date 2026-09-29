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
  const { url, headers } = context();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
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
  return request(`toolbox_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.asc&limit=200`);
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
  // Older databases without vote_poll: fall back to writing the poll back, checked.
  const missing = response.status === 404 || error.code === 'PGRST202' || /vote_poll/.test(error.message || '');
  if (!missing || !current) throw new Error(error.message || `Your vote could not be saved (${response.status}).`);
  const { user } = context();
  const had = (current.options?.[optionIndex]?.voters || []).includes(user.id);
  const options = (current.options || []).map((o, i) => ({ ...o, voters: [...(o.voters || []).filter(v => v !== user.id), ...(i === optionIndex && !had ? [user.id] : [])] }));
  const row = await updateMessagePayload(messageId, { ...current, options });
  return row.payload;
}

export async function uploadMessageFile(file) {
  if (!file || file.size > MESSAGE_FILE_LIMIT) throw new Error('Shared files must be 8 MB or smaller.');
  const { user, url, headers } = context();
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
  // Documents, PDFs and text travel packed (lossless, fingerprint-checked); the recipient's
  // Toolbox unpacks them on download. Photos, video and archives go as they are.
  const { packForTransfer } = await import('./transfer-pack.js');
  const pack = await packForTransfer(file);
  const path = `${user.id}/messages/${crypto.randomUUID()}-${safeName}${pack.packed ? '.kpk' : ''}`;
  const response = await fetch(`${url}/storage/v1/object/toolbox-files/${path}`, { method: 'POST', headers: { apikey: headers.apikey, Authorization: headers.Authorization, 'Content-Type': pack.packed ? 'application/octet-stream' : (file.type || 'application/octet-stream'), 'x-upsert': 'false' }, body: pack.blob });
  if (!response.ok) throw new Error('The file could not be uploaded.');
  return { name: file.name, size: file.size, type: file.type, url: `${url}/storage/v1/object/public/toolbox-files/${path}`, ...(pack.packed ? { packed: true, packedSize: pack.packedSize } : {}) };
}

export async function listOnlineToolboxFiles() {
  return request('saved_artifacts?select=id,name,kind,storage_url,payload,updated_at&order=updated_at.desc&limit=50');
}
