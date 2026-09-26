/* ============================================================
   Assistant Real DOM Interaction Test
   Assistant runs on Toolbox's servers and needs an account, so a
   signed-out visitor must get the full chat shell with a sign-in
   prompt and a composer that cannot send.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { default: assistantTool } = await import('../../js/tools/assistant.js');

function mount() {
  const container = document.createElement('div');
  container.id = 'viewport-content';
  document.body.appendChild(container);
  assistantTool.render(container, { tool: { id: 'assistant', name: 'Assistant' } });
  return container;
}

test('Assistant Interaction: renders the chat shell with thread, composer and send button', (t) => {
  const container = mount();
  t.after(() => { assistantTool.destroy(); container.remove(); });

  assert.ok(container.querySelector('.ast .ast-side .ast-convs'), 'Chat history sidebar exists');
  assert.ok(container.querySelector('.ast-scroll .ast-thread[role="log"]'), 'Message thread exists and is a live log');
  assert.ok(container.querySelector('form.ast-composer textarea.ast-input'), 'Composer textarea exists');
  assert.ok(container.querySelector('.ast-composer .ast-send'), 'Send button exists');
});

test('Assistant Interaction: signed-out visitors see a sign-in prompt and cannot send', async (t) => {
  const container = mount();
  t.after(() => { assistantTool.destroy(); container.remove(); });

  // The thread fills in once the conversation store has loaded.
  let signIn = null;
  for (let i = 0; i < 50 && !signIn; i++) {
    await new Promise((r) => setTimeout(r, 10));
    signIn = container.querySelector('.ast-thread .ast-signin');
  }
  assert.ok(signIn, 'Sign-in prompt is shown in the thread');
  assert.ok(signIn.querySelector('[data-act="sign-in"]'), 'Sign-in prompt has a sign-in button');
  assert.match(signIn.textContent, /Sign in to use Assistant/);

  const input = container.querySelector('.ast-input');
  const send = container.querySelector('.ast-send');
  assert.equal(input.disabled, true, 'Composer is disabled while signed out');
  assert.equal(send.disabled, true, 'Send is disabled while signed out');
});
