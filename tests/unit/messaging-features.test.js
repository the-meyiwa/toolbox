import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

test('Messaging Features: searchPublicProfiles searches by name and username', async () => {
  const { searchPublicProfiles, getPublicProfiles } = await import('../../js/lib/profile-system.js');
  
  const all = getPublicProfiles();
  assert.ok(all.length >= 10, 'Must have realistic user directory with >= 10 profiles');

  // Search by display name
  const aliceMatches = searchPublicProfiles('Alice');
  assert.ok(aliceMatches.length >= 1, 'Must find Alice by display name');
  assert.equal(aliceMatches[0].name, 'Alice Smith');

  // Search by @username
  const bobMatches = searchPublicProfiles('@bob.ops');
  assert.ok(bobMatches.length >= 1, 'Must find Bob by @username');
  assert.equal(bobMatches[0].username, 'bob.ops');

  // Search by partial username
  const charlieMatches = searchPublicProfiles('charlie');
  assert.ok(charlieMatches.length >= 1, 'Must find Charlie by partial username');
  assert.equal(charlieMatches[0].username, 'charlie.data');
});

test('Messaging Features: Super-expanded Messaging Tool elements', async () => {
  setupDOMEnvironment();
  const messagingModule = (await import('../../js/tools/messaging.js')).default;
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  messagingModule.render(container);

  // Search and tabs
  assert.ok(container.querySelector('#msg-search-input'), 'Must have search input');
  assert.ok(container.querySelector('#tab-btn-chats'), 'Must have Chats tab');
  assert.ok(container.querySelector('#tab-btn-people'), 'Must have People tab');

  // Action buttons
  assert.ok(container.querySelector('#msg-attach-btn'), 'Must have File attachment button');
  assert.ok(container.querySelector('#msg-poll-btn'), 'Must have Poll creation button');
  assert.ok(container.querySelector('#msg-chess-btn'), 'Must have Chess game button');
  assert.ok(container.querySelector('#msg-ast-btn'), 'Must have Assistant trigger button');

  messagingModule.destroy();
});

test('Mail Tool: Theme tokens in CSS have zero dark slate or inverted text bugs', () => {
  const mailJs = fs.readFileSync(path.resolve('js/tools/mail.js'), 'utf8');

  // Ensure no hardcoded dark slate background
  assert.ok(!mailJs.includes('#0f172a'), 'Must not contain hardcoded dark slate #0f172a');
  assert.ok(!mailJs.includes('background-color: var(--surface));'), 'Must not contain double parenthesis syntax error');

  // Ensure unread sender text is adaptive var(--text) rather than hardcoded pure white
  assert.ok(!mailJs.includes('.mail-item.unread .mail-item-sender {\n          font-weight: 700;\n          color: #ffffff;\n        }'), 'Must not hardcode pure white text on unread mail items');
  assert.ok(mailJs.includes('color: var(--text);'), 'Must use canonical var(--text) token');
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
