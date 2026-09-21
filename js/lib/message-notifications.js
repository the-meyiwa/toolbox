import { getCurrentUser } from './supabase.js';
import { listConversations, listMessages } from './messaging-service.js';
import { NotificationEngine } from './notifications.js';

const cursorKey = userId => `toolbox_message_notification_cursor_${userId}`;
let timer = 0;
let running = false;

function readCursors(userId) {
  try { return JSON.parse(localStorage.getItem(cursorKey(userId)) || '{}') || {}; } catch { return {}; }
}

function writeCursors(userId, cursors) {
  try { localStorage.setItem(cursorKey(userId), JSON.stringify(cursors)); } catch {}
}

function preview(message) {
  if (message.kind === 'file') return `Shared ${message.payload?.name || 'a file'}`;
  if (message.kind === 'poll') return message.payload?.question || 'Shared a poll';
  if (message.kind === 'game') return 'Started a game';
  if (message.kind === 'participant_request') return message.body || 'Requested a new participant';
  return message.body || 'Sent a message';
}

async function checkMessages() {
  if (running) return;
  const user = getCurrentUser();
  if (!user?.id) return;
  running = true;
  try {
    const conversations = await listConversations();
    const cursors = readCursors(user.id);
    const firstRun = Object.keys(cursors).length === 0;
    for (const conversation of conversations) {
      const id = conversation.conversation_id;
      const messages = await listMessages(id);
      const latest = messages.at(-1)?.created_at;
      if (!latest) continue;
      const activeId = new URLSearchParams((location.hash.split('?')[1] || '')).get('conversation');
      if (activeId === id) {
        cursors[id] = latest;
        await NotificationEngine.clearConversation(id);
        continue;
      }
      if (!firstRun && cursors[id]) {
        for (const message of messages.filter(item => item.sender_id !== user.id && item.created_at > cursors[id])) {
          const sender = conversation.other_name || conversation.other_username || 'New message';
          await NotificationEngine.addNotification(sender, preview(message), 'message', `#messaging?conversation=${encodeURIComponent(id)}`, `message-${message.id}`, { conversationId: id, messageId: message.id });
        }
      }
      cursors[id] = latest;
    }
    writeCursors(user.id, cursors);
  } catch { /* Messaging may be unavailable before its database migration is installed. */ }
  finally { running = false; }
}

export function initMessageNotifications() {
  clearInterval(timer);
  void checkMessages();
  timer = setInterval(checkMessages, 7000);
  const restart = () => { running = false; void checkMessages(); };
  window.addEventListener('toolbox:authchange', restart);
  window.addEventListener('focus', restart);
  return () => { clearInterval(timer); window.removeEventListener('toolbox:authchange', restart); window.removeEventListener('focus', restart); };
}
