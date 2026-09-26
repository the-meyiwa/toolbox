import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

test('Messaging Features: uses authenticated directory rather than dummy profiles', async () => {
  const source = fs.readFileSync(path.resolve('js/lib/user-directory.js'), 'utf8');
  assert.ok(source.includes('/rest/v1/profiles'));
  assert.ok(!source.includes('Alice Smith'));
  assert.ok(!source.includes('DEFAULT_MOCK_PROFILES'));
});

test('Messaging Features: Super-expanded Messaging Tool elements', async () => {
  setupDOMEnvironment();
  localStorage.setItem('toolbox_supabase_session', JSON.stringify({ id:'me', email:'me@example.com', token:'test-token', username:'me', displayName:'Me' }));
  const messagingModule = (await import('../../js/tools/messaging.js')).default;
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  messagingModule.render(container);

  assert.ok(container.querySelector('#messages-search'), 'Must have account directory search');
  assert.ok(container.querySelector('#messages-attach'), 'Must have file sharing');
  assert.ok(container.querySelector('#messages-game'), 'Must have a game action');
  assert.ok(container.querySelector('#messages-compose'), 'Must have the conversation composer');
  assert.deepEqual(
    [...container.querySelectorAll('[data-message-action]')].map(button => button.dataset.messageAction),
    ['poll', 'media', 'files', 'participant'],
    'The animated add menu must expose all four collaboration actions'
  );
  assert.deepEqual([...container.querySelectorAll('[data-file-source]')].map(button => button.dataset.fileSource), ['online', 'offline']);

  messagingModule.destroy();
});

test('Messaging Features: background refreshes preserve reading position and participant search is inline', () => {
  const source = fs.readFileSync(path.resolve('js/tools/messaging.js'), 'utf8');
  assert.match(source, /Search Toolbox by name or username/);
  assert.match(source, /messagesFingerprint/);
  assert.match(source, /wasNearBottom/);
  assert.match(source, /previousTop \+ \(stream\.scrollHeight - previousHeight\)/);
  assert.doesNotMatch(source, /title:'Add a participant'/);
});

test('Messaging Features: notifications open conversations and support direct replies', () => {
  const app = fs.readFileSync(path.resolve('js/app.js'), 'utf8');
  const messaging = fs.readFileSync(path.resolve('js/tools/messaging.js'), 'utf8');
  const header = fs.readFileSync(path.resolve('js/lib/header-menu.js'), 'utf8');
  assert.match(app, /initMessageNotifications/);
  assert.match(app, /messagingParams\.get\('conversation'\)/);
  assert.match(messaging, /NotificationEngine\.clearConversation/);
  assert.match(header, /notif-inline-reply/);
  assert.match(header, /await sendMessage\(notification\.data\.conversationId, value\)/);
});

test('Mail Tool: Theme tokens in CSS have zero dark slate or inverted text bugs', () => {
  const mailJs = fs.readFileSync(path.resolve('js/tools/mail.js'), 'utf8');
  const mailCss = fs.readFileSync(path.resolve('css/mail.css'), 'utf8');

  for (const [name, src] of [['mail.js', mailJs], ['mail.css', mailCss]]) {
    assert.ok(!src.includes('#0f172a'), `${name} must not contain hardcoded dark slate #0f172a`);
    assert.ok(!src.includes('var(--surface));'), `${name} must not contain double parenthesis syntax error`);
  }
  assert.ok(!/\.mail-item\.unread[^{]*\{[^}]*color:\s*#fff(?:fff)?\b/i.test(mailCss), 'Must not hardcode pure white text on unread mail items');
  assert.ok(mailCss.includes('color: var(--text)'), 'Mail styles must use the canonical var(--text) token');
});

test('App: Related tools are removed from general tools and preserved on file upload tools', () => {
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf8');

  // Must have the file upload tool whitelist & detection
  assert.ok(appJs.includes('isSimpleFileUploadTool'), 'app.js must implement isSimpleFileUploadTool');
  assert.ok(appJs.includes('image-compressor') && appJs.includes('pdf-merge'), 'FILE_UPLOAD_TOOL_IDS must include file tools');
  assert.ok(appJs.includes('!isSimpleFileUploadTool(tool, viewportContent)'), 'renderRelated must suppress related tools for non-file tools');
});

test('Spaces Tool: removed completely from registry and Slide 2', () => {
  const toolsJs = fs.readFileSync(path.resolve('js/registry/tools.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');

  assert.ok(!toolsJs.includes("id: 'spaces'"), 'Spaces tool must be removed from tool registry');
  assert.ok(!indexHtml.includes('id="home-spaces-panel"'), 'home-spaces-panel must be removed from index.html');
  assert.ok(!fs.existsSync(path.resolve('js/tools/spaces.js')), 'js/tools/spaces.js must be deleted');
});
