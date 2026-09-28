/* ============================================================
   TOOLBOX — Message notifications

   Polls the person's conversations and notifies them of new
   messages — but only ones they have not seen and are not
   already talking about:
   - a conversation open in Messaging (on screen) never notifies;
     opening one marks it read and clears its notifications;
   - messages older than the person's own latest reply in that
     thread are treated as read (they answered, so they saw them,
     on this device or another);
   - while the person is actively chatting (they sent a message
     in the thread in the last few minutes) nothing pops up.
   Only conversations whose last message changed are fetched.
   ============================================================ */

import { getCurrentUser } from './supabase.js';
import { listConversations, listMessages } from './messaging-service.js';
import { NotificationEngine } from './notifications.js';

const cursorKey = userId => `toolbox_message_notification_cursor_${userId}`;
const readKey = userId => `toolbox_message_read_${userId}`;
const ACTIVE_CHAT_MS = 5 * 60_000;
let timer = 0;
let running = false;
let openConversation = null;   // the conversation shown in Messaging, if any

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };

/** Marks a conversation read up to now: no notification for anything already in it. */
export function markConversationRead(conversationId, at = new Date().toISOString()) {
  const user = getCurrentUser();
  if (!user?.id || !conversationId) return;
  const read = readJson(readKey(user.id));
  if (!read[conversationId] || read[conversationId] < at) read[conversationId] = at;
  writeJson(readKey(user.id), read);
}

function preview(message) {
  if (message.kind === 'file') return `Shared ${message.payload?.name || 'a file'}`;
  if (message.kind === 'poll') return message.payload?.question || 'Shared a poll';
  if (message.kind === 'game') return 'Started a game';
  if (message.kind === 'participant_request') return message.body || 'Requested a new participant';
  return message.body || 'Sent a message';
}

const messagingOnScreen = () => typeof document !== 'undefined' && !document.hidden && /^#messaging\b/.test(location.hash || '');

function viewing(id) {
  if (!messagingOnScreen()) return false;
  const fromHash = new URLSearchParams((location.hash.split('?')[1] || '')).get('conversation');
  return id === fromHash || id === openConversation;
}

/** Which of a conversation's messages deserve a notification. */
export function unseenMessages(messages, { userId, cursor, readAt, now = Date.now() }) {
  const mine = messages.filter(m => m.sender_id === userId);
  const lastMine = mine.at(-1)?.created_at || '';
  // Talking right now: no pop-ups for this thread.
  if (lastMine && now - Date.parse(lastMine) < ACTIVE_CHAT_MS) return [];
  const seenUpTo = [cursor, readAt, lastMine].filter(Boolean).sort().at(-1) || '';
  return messages.filter(m => m.sender_id !== userId && m.created_at > seenUpTo);
}

async function checkMessages() {
  if (running) return;
  const user = getCurrentUser();
  if (!user?.id) return;
  running = true;
  try {
    const conversations = await listConversations();
    const cursors = readJson(cursorKey(user.id));
    const read = readJson(readKey(user.id));
    const firstRun = Object.keys(cursors).length === 0;
    for (const conversation of conversations) {
      const id = conversation.conversation_id;
      const last = conversation.last_message_at;
      if (!last) continue;
      if (viewing(id)) {
        cursors[id] = last;
        markConversationRead(id, last);
        await NotificationEngine.clearConversation(id);
        continue;
      }
      // Nothing new since the last look: no need to fetch the thread.
      if (cursors[id] && last <= cursors[id]) continue;
      const messages = await listMessages(id);
      const latest = messages.at(-1)?.created_at || last;
      if (!firstRun && cursors[id]) {
        const fresh = unseenMessages(messages, { userId: user.id, cursor: cursors[id], readAt: read[id] });
        const sender = conversation.other_name || conversation.other_username || 'New message';
        for (const message of fresh) {
          await NotificationEngine.addNotification(sender, preview(message), 'message', `#messaging?conversation=${encodeURIComponent(id)}`, `message-${message.id}`, { conversationId: id, messageId: message.id });
        }
        // They replied (here or elsewhere): what they answered is read, so drop its alerts.
        if (!fresh.length && messages.some(m => m.sender_id === user.id && m.created_at > cursors[id])) await NotificationEngine.clearConversation(id);
      }
      cursors[id] = latest;
    }
    writeJson(cursorKey(user.id), cursors);
  } catch { /* Messaging may be unavailable before its database migration is installed. */ }
  finally { running = false; }
}

export function initMessageNotifications() {
  clearInterval(timer);
  void checkMessages();
  timer = setInterval(checkMessages, 7000);
  const restart = () => { running = false; void checkMessages(); };
  const onOpen = (e) => {
    openConversation = e.detail?.id || null;
    if (openConversation) { markConversationRead(openConversation); void NotificationEngine.clearConversation(openConversation); }
  };
  const onHash = () => { if (!/^#messaging\b/.test(location.hash || '')) openConversation = null; };
  window.addEventListener('toolbox:authchange', restart);
  window.addEventListener('focus', restart);
  window.addEventListener('toolbox:conversation-open', onOpen);
  window.addEventListener('hashchange', onHash);
  return () => {
    clearInterval(timer);
    window.removeEventListener('toolbox:authchange', restart);
    window.removeEventListener('focus', restart);
    window.removeEventListener('toolbox:conversation-open', onOpen);
    window.removeEventListener('hashchange', onHash);
  };
}
