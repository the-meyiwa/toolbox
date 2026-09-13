/* ============================================================
   Messaging Tool Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { BY_ID } from '../../js/registry/index.js';

test('Messaging Tool: is properly registered in tool registry', () => {
  const tool = BY_ID.get('messaging');
  assert.ok(tool, 'Messaging tool must be registered in BY_ID');
  assert.equal(tool.name, 'Messaging');
  assert.equal(tool.category, 'everyday');
  assert.ok(tool.description.length > 10);
  assert.ok(!tool.description.endsWith('.'), 'Description must not end with a period');
  assert.ok(tool.keywords.includes('chat'));
  assert.ok(tool.synonyms.includes('messages'));
  assert.ok(tool.offline);
});

test('Messaging Tool: module exports render and destroy lifecycle', async () => {
  const mod = await import('../../js/tools/messaging.js');
  const tool = mod.default;
  assert.ok(tool, 'Tool module must export default object');
  assert.equal(typeof tool.render, 'function');
  assert.equal(typeof tool.destroy, 'function');
});

test('Messaging Tool: renders sidebar, message stream, and composer', async () => {
  setupDOMEnvironment();
  const mod = await import('../../js/tools/messaging.js');
  const tool = mod.default;

  const container = document.createElement('div');
  document.body.appendChild(container);

  tool.render(container);

  assert.ok(container.querySelector('#msg-sidebar'), 'Must render #msg-sidebar');
  assert.ok(container.querySelector('#msg-search-input'), 'Must render search input');
  assert.ok(container.querySelector('#msg-conv-list'), 'Must render conversations list');
  assert.ok(container.querySelector('#msg-stream'), 'Must render message stream');
  assert.ok(container.querySelector('#msg-composer-input'), 'Must render message textarea');
  assert.ok(container.querySelector('#msg-send-btn'), 'Must render send button');
  assert.ok(container.querySelector('#msg-attach-btn'), 'Must render attachment button');

  // Verify zero technical jargon in initial UI
  const text = container.textContent.toLowerCase();
  assert.ok(!text.includes('webrtc'), 'Must not expose WebRTC jargon');
  assert.ok(!text.includes('signaling'), 'Must not expose signaling jargon');
  assert.ok(!text.includes('stun'), 'Must not expose STUN/TURN jargon');
  assert.ok(!text.includes('peer-to-peer'), 'Must not expose peer-to-peer jargon');

  tool.destroy();
  container.remove();
});
