/* ============================================================
   TOOLBOX — Assistant tools for Mail

   The Assistant reads and works the person's connected mailbox
   (Gmail or Outlook, through /api/mail — keys never reach the
   browser):
     mail_search   find messages (Gmail/Outlook search syntax, folder, unread)
     mail_read     read one message or its whole thread as text
     mail_send     send a new email          (asks the person first)
     mail_reply    reply / reply-all / forward (asks the person first)
     mail_action   mark read/unread, star, archive, trash (trash asks first)

   Results are compact (sender, subject, date, snippet) so a
   mailbox does not flood the model; bodies are capped.
   ============================================================ */

import { registerToolPack } from './tool-packs.js';

const BODY_LIMIT = 6000;

async function api() {
  const { mailApi } = await import('../mail-provider.js');
  return mailApi;
}

const who = (a) => (a ? (a.name ? `${a.name} <${a.email}>` : a.email || '') : '');
const list = (xs) => (Array.isArray(xs) ? xs.map(who).filter(Boolean).join(', ') : who(xs));
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

function toText(html) {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Drops the quoted history under a reply ("On … wrote:", "> …"), which is usually most of an email. */
function stripQuoted(text) {
  const lines = String(text).split('\n');
  const cut = lines.findIndex(l => /^On .{5,200}wrote:\s*$/i.test(l.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim()) || /^From: .+/i.test(l.trim()) && lines.some(x => /^Sent: /i.test(x.trim())));
  const kept = (cut > 0 ? lines.slice(0, cut) : lines).filter(l => !/^\s*>/.test(l));
  return kept.join('\n').trim();
}

const bodyOf = (m) => {
  const raw = m?.text && m.text.trim() ? m.text : toText(m?.html);
  const text = stripQuoted(raw);
  return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)}\n[… ${text.length - BODY_LIMIT} more characters]` : text;
};

const summary = (m) => ({
  id: m.id,
  threadId: m.threadId,
  from: who(m.from),
  subject: m.subject || '(no subject)',
  date: when(m.date),
  snippet: String(m.snippet || '').slice(0, 200),
  unread: Boolean(m.unread),
  starred: Boolean(m.starred),
  attachments: Boolean(m.hasAttachments),
});

function notConnected(err) {
  const msg = String(err?.message || err || '');
  if (err?.status === 401 && /sign in/i.test(msg)) return { status: 'error', success: false, message: 'Sign in to Toolbox to use Mail.' };
  if (err?.code === 'noaccount' || /No mailbox is connected/i.test(msg)) {
    return { status: 'error', success: false, code: 'mail_not_connected', link: '#mail', message: 'No mailbox is connected. Open Mail to connect Gmail or Outlook, then ask again.' };
  }
  return null;
}

const htmlOf = (text) => String(text || '').split(/\n{2,}/).map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');

export const MAIL_DECLARATIONS = [
  {
    name: 'mail_search',
    description: 'Searches the person\'s connected mailbox (Gmail or Outlook). Returns sender, subject, date and a snippet per message, newest first. Use for "any emails from…", "what did X send", "unread mail", "find the invoice email".',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search words; Gmail syntax works on Gmail (from:ada subject:invoice has:attachment newer_than:7d).' },
        folder: { type: 'string', description: 'inbox (default without a query), sent, drafts, spam, trash, or a label/folder id.' },
        unread: { type: 'boolean', description: 'Only unread messages.' },
        limit: { type: 'number', description: 'How many (default 10, up to 25).' },
      },
    },
  },
  {
    name: 'mail_read',
    description: 'Reads one email as text (quoted history removed), or its whole conversation with thread: true. Use the id from mail_search.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Message id from mail_search.' },
        thread: { type: 'boolean', description: 'Read the whole conversation.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'mail_send',
    description: 'Sends a new email from the connected mailbox. The person is asked to approve it first. Write the full body in plain text.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient addresses.' },
        cc: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain-text body; blank lines separate paragraphs.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'mail_reply',
    description: 'Replies to (or forwards) a message in its thread. The person is asked to approve it first.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The message being answered (from mail_search / mail_read).' },
        body: { type: 'string', description: 'Plain-text reply.' },
        mode: { type: 'string', enum: ['reply', 'replyAll', 'forward'], description: 'Default reply.' },
        to: { type: 'array', items: { type: 'string' }, description: 'Forward only: who to send it to.' },
      },
      required: ['id', 'body'],
    },
  },
  {
    name: 'mail_draft',
    description: 'Opens a pre-filled draft in the Mail tool for the person to review, edit and send themselves: a new email, or a reply/forward to a message (replyToId). Prefer this over mail_send/mail_reply unless the person clearly asked you to send it.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' } },
        cc: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain-text body.' },
        replyToId: { type: 'string', description: 'Message to reply to or forward (from mail_search).' },
        mode: { type: 'string', enum: ['reply', 'replyAll', 'forward'] },
      },
      required: ['body'],
    },
  },
  {
    name: 'mail_action',
    description: 'Marks messages read or unread, stars or unstars, archives or moves them to trash (trash asks the person first).',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Message ids.' },
        action: { type: 'string', enum: ['read', 'unread', 'star', 'unstar', 'archive', 'trash'] },
      },
      required: ['ids', 'action'],
    },
  },
];

async function execute(name, args = {}) {
  let mail;
  try { mail = await api(); } catch { return { status: 'error', success: false, message: 'Mail is not available here.' }; }
  // The mailbox chosen in Mail; if it was disconnected since, fall back to the first one.
  let accountId = mail.activeAccountId || undefined;
  if (accountId) {
    try { const s = await mail.status(); if (!(s.accounts || []).some(a => a.id === accountId)) accountId = undefined; } catch { /* the call below reports it */ }
  }
  try {
    if (name === 'mail_search') {
      const limit = Math.min(25, Math.max(1, Math.round(Number(args.limit) || 10)));
      let q = String(args.query || '').trim();
      if (args.unread) q = `${q} is:unread`.trim();
      const res = await mail.messages({ accountId, q, folder: args.folder || '', limit });
      const found = (res.messages || []).slice(0, limit).map(summary);
      return {
        status: 'success', type: 'mail-list', renderer: 'mail-list',
        query: q, folder: args.folder || (q ? 'all' : 'inbox'), messages: found, link: '#mail',
        message: found.length ? `${found.length} message${found.length === 1 ? '' : 's'}${q ? ` for "${q}"` : ''}.` : `No messages${q ? ` match "${q}"` : ''}.`,
      };
    }
    if (name === 'mail_read') {
      if (args.thread) {
        const t = await mail.thread(accountId, args.id);
        const msgs = (t?.messages || []).slice(-8);
        return {
          status: 'success', type: 'mail-thread', renderer: 'mail-message',
          subject: t?.subject || msgs[0]?.subject || '(no subject)',
          messages: msgs.map(m => ({ id: m.id, from: who(m.from), to: list(m.to), date: when(m.date), body: bodyOf(m) })),
          message: `Conversation "${t?.subject || ''}" (${(t?.messages || []).length} message${(t?.messages || []).length === 1 ? '' : 's'}${(t?.messages || []).length > 8 ? ', latest 8 shown' : ''}).`,
        };
      }
      const m = await mail.message(accountId, args.id);
      if (!m) return { status: 'error', success: false, message: 'That message was not found.' };
      if (m.unread) mail.action(accountId, 'read', [m.id]).catch(() => {});
      return {
        status: 'success', type: 'mail-thread', renderer: 'mail-message', subject: m.subject || '(no subject)',
        messages: [{ id: m.id, from: who(m.from), to: list(m.to), cc: list(m.cc), date: when(m.date), body: bodyOf(m), attachments: (m.attachments || []).map(a => a.filename).filter(Boolean) }],
        message: `Email from ${who(m.from)}: "${m.subject || '(no subject)'}".`,
      };
    }
    if (name === 'mail_send') {
      const res = await mail.send(accountId, { to: args.to, cc: args.cc || [], subject: args.subject, html: htmlOf(args.body), text: String(args.body || ''), mode: 'new' });
      return { status: 'success', type: 'mail-sent', id: res?.id || null, message: `Sent "${args.subject}" to ${[].concat(args.to).join(', ')}.` };
    }
    if (name === 'mail_reply') {
      const original = await mail.message(accountId, args.id);
      if (!original) return { status: 'error', success: false, message: 'The message to reply to was not found.' };
      const mode = ['reply', 'replyAll', 'forward'].includes(args.mode) ? args.mode : 'reply';
      let to;
      if (mode === 'forward') {
        to = [].concat(args.to || []).filter(Boolean);
        if (!to.length) return { status: 'error', success: false, message: 'Say who to forward it to.' };
      } else {
        to = [original.replyTo?.[0] || original.from].filter(Boolean).map(a => a.email || a);
        if (mode === 'replyAll') to = [...new Set([...to, ...(original.to || []).map(a => a.email)])];
      }
      const subject = mode === 'forward'
        ? (/^fwd?:/i.test(original.subject || '') ? original.subject : `Fwd: ${original.subject || ''}`)
        : (/^re:/i.test(original.subject || '') ? original.subject : `Re: ${original.subject || ''}`);
      const quoted = `\n\n${mode === 'forward' ? '---------- Forwarded message ----------' : `On ${when(original.date)}, ${who(original.from)} wrote:`}\n${bodyOf(original).split('\n').map(l => `> ${l}`).join('\n')}`;
      const text = `${args.body}${quoted}`;
      const res = await mail.send(accountId, {
        to, cc: mode === 'replyAll' ? (original.cc || []).map(a => a.email) : [], subject,
        html: htmlOf(args.body) + `<blockquote>${htmlOf(bodyOf(original))}</blockquote>`, text,
        inReplyTo: original.messageId || original.internetMessageId || '', references: original.references || original.messageId || '',
        threadId: mode === 'forward' ? '' : original.threadId, replyToId: original.id, mode,
      });
      return { status: 'success', type: 'mail-sent', id: res?.id || null, message: `${mode === 'forward' ? 'Forwarded' : 'Replied to'} "${original.subject || '(no subject)'}"${mode === 'forward' ? ` to ${to.join(', ')}` : ''}.` };
    }
    if (name === 'mail_draft') {
      const { setMailIntent } = await import('../mail-provider.js');
      setMailIntent({ type: 'compose', to: args.to || [], cc: args.cc || [], subject: args.subject || '', body: args.body, replyToId: args.replyToId || '', mode: args.mode || '' });
      if (typeof window !== 'undefined' && window.location) window.location.hash = '#mail';
      return { status: 'success', type: 'mail-draft', message: `Opened a draft${args.replyToId ? ' reply' : ''} in Mail${args.subject ? ` ("${args.subject}")` : ''} for the person to review and send.` };
    }
    if (name === 'mail_action') {
      const ids = [].concat(args.ids || []).filter(Boolean).slice(0, 100);
      if (!ids.length) return { status: 'error', success: false, message: 'Give the message ids (from mail_search).' };
      await mail.action(accountId, args.action, ids);
      const verb = { read: 'Marked read', unread: 'Marked unread', star: 'Starred', unstar: 'Unstarred', archive: 'Archived', trash: 'Moved to trash' }[args.action] || 'Updated';
      return { status: 'success', message: `${verb}: ${ids.length} message${ids.length === 1 ? '' : 's'}.` };
    }
  } catch (err) {
    return notConnected(err) || { status: 'error', success: false, message: `Mail did not answer: ${err?.message || 'unknown error'}` };
  }
  return undefined;
}

registerToolPack({
  id: 'mail',
  declarations: MAIL_DECLARATIONS,
  execute,
  groups: {
    mail: {
      label: 'Mail: search, read, reply to and send email from the connected Gmail or Outlook, archive, star, trash',
      tools: MAIL_DECLARATIONS.map(d => d.name),
      match: /\b(e-?mails?|inbox|mailbox|gmail|outlook|unread (mail|messages)|reply to|forward (it|this|the)|send (an? )?(email|mail)|mail (from|to)|newsletter|cc|bcc|archive (it|them|these))\b/i,
    },
  },
});

export { execute as executeMailTool, stripQuoted, toText };
