/* ============================================================
   Assistant ↔ Mail: the tools drive the Mail tool's API and
   hand drafts and messages over to the Mail tool.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
localStorage.setItem('toolbox_supabase_session', JSON.stringify({ id: 'u1', token: 't1', email: 'me@example.com' }));

const calls = [];
const inbox = [
  { id: 'm1', threadId: 't1', from: { name: 'Ada', email: 'ada@example.com' }, to: [{ email: 'me@example.com' }], subject: 'Invoice 42', snippet: 'Please find attached', date: '2026-09-20T09:00:00Z', unread: true, hasAttachments: true },
];
const full = { ...inbox[0], messageId: '<abc@mail>', text: 'Hi,\n\nPlease pay by Friday.\n\nOn Mon, Bob wrote:\n> old text', attachments: [{ filename: 'invoice.pdf' }] };
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url, 'http://localhost');
  calls.push({ path: u.pathname, params: Object.fromEntries(u.searchParams), body: opts.body ? JSON.parse(opts.body) : null });
  const route = u.pathname.replace('/api/mail/', '');
  const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  if (globalThis.__noAccount) return json({ success: false, error: 'No mailbox is connected. Connect Gmail or Microsoft first.', code: 'noaccount' }, 404);
  if (route === 'status') return json({ success: true, accounts: [{ id: 'acc1', email: 'me@example.com', provider: 'google' }] });
  if (route === 'messages') return json({ success: true, messages: inbox });
  if (route === 'message') return json({ success: true, message: full });
  if (route === 'send') return json({ success: true, id: 'sent1' });
  if (route === 'action') return json({ success: true, results: [] });
  return json({ success: false, error: 'unknown' }, 404);
};

const { executeMailTool, stripQuoted } = await import('../../js/lib/assistant/mail-tools.js');
const { takeMailIntent } = await import('../../js/lib/mail-provider.js');

test('Mail tools: search returns compact summaries from the Mail API', async () => {
  const r = await executeMailTool('mail_search', { query: 'from:ada', unread: true, limit: 50 });
  assert.equal(r.status, 'success');
  assert.equal(r.type, 'mail-list');
  assert.equal(r.messages[0].from, 'Ada <ada@example.com>');
  assert.equal(r.messages[0].subject, 'Invoice 42');
  const q = calls.find(c => c.path.endsWith('/messages'));
  assert.equal(q.params.q, 'from:ada is:unread');
  assert.equal(q.params.limit, '25', 'limit is capped');
});

test('Mail tools: read strips quoted history and marks the message read', async () => {
  calls.length = 0;
  const r = await executeMailTool('mail_read', { id: 'm1' });
  assert.equal(r.type, 'mail-thread');
  assert.equal(r.messages[0].body, 'Hi,\n\nPlease pay by Friday.');
  assert.deepEqual(r.messages[0].attachments, ['invoice.pdf']);
  await new Promise(res => setTimeout(res, 0));
  assert.ok(calls.some(c => c.path.endsWith('/action') && c.body.action === 'read'));
  assert.equal(stripQuoted('ok\n> quoted\nmore'), 'ok\nmore');
});

test('Mail tools: reply threads the answer to the original', async () => {
  calls.length = 0;
  const r = await executeMailTool('mail_reply', { id: 'm1', body: 'Paid, thanks.' });
  assert.equal(r.status, 'success');
  const sent = calls.find(c => c.path.endsWith('/send')).body;
  assert.deepEqual(sent.to, ['ada@example.com']);
  assert.equal(sent.subject, 'Re: Invoice 42');
  assert.equal(sent.threadId, 't1');
  assert.equal(sent.inReplyTo, '<abc@mail>');
  assert.match(sent.text, /^Paid, thanks\.\n\nOn .*Ada <ada@example.com> wrote:\n> Hi,/);
  const fwd = await executeMailTool('mail_reply', { id: 'm1', body: 'FYI', mode: 'forward' });
  assert.match(fwd.message, /Say who to forward/);
});

test('Mail tools: drafts are handed to the Mail tool, not sent', async () => {
  calls.length = 0;
  const r = await executeMailTool('mail_draft', { to: ['bob@example.com'], subject: 'Hello', body: 'Draft text' });
  assert.equal(r.type, 'mail-draft');
  assert.ok(!calls.some(c => c.path.endsWith('/send')), 'nothing is sent');
  const intent = takeMailIntent();
  assert.equal(intent.type, 'compose');
  assert.deepEqual(intent.to, ['bob@example.com']);
  assert.equal(takeMailIntent(), null, 'taken once');
});

test('Mail tools: no mailbox connected gives a clear next step', async () => {
  globalThis.__noAccount = true;
  const r = await executeMailTool('mail_search', {});
  globalThis.__noAccount = false;
  assert.equal(r.code, 'mail_not_connected');
  assert.match(r.message, /Open Mail to connect Gmail or Outlook/);
});
