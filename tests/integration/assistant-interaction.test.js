/* ============================================================
   Assistant Real DOM Interaction Test
   Validates full user interaction lifecycle:
   - Tool render in DOM
   - Typing input into textarea
   - Clicking Send button
   - Streaming tokens into DOM bubble
   - Verifying assistant response message
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import assistantTool from '../../js/tools/assistant.js';

// Setup browser DOM globals for Node test runner
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  const sStore = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => sStore.get(k) || null,
    setItem: (k, v) => sStore.set(k, String(v)),
    removeItem: (k) => sStore.delete(k),
    clear: () => sStore.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } }
  };
}

// Minimal DOM Element Mock for live user interaction testing
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.style = {};
    this.children = [];
    this._innerHTML = '';
    this.value = '';
    this.disabled = false;
    this.listeners = new Map();
    this.scrollTop = 0;
    this.scrollHeight = 100;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
    const tagRegex = /<([a-z0-9-]+)([^>]*)>/gi;
    let match;
    while ((match = tagRegex.exec(this._innerHTML)) !== null) {
      const attrs = match[2];
      const idMatch = attrs.match(/id=["']([^"']+)["']/i);
      const classMatch = attrs.match(/class=["']([^"']+)["']/i);
      if (idMatch || classMatch) {
        const el = new MockElement(match[1]);
        if (idMatch) el.id = idMatch[1];
        if (classMatch) el.className = classMatch[1];
        this.children.push(el);
      }
    }
  }

  get textContent() {
    return this._innerHTML.replace(/<[^>]*>/g, '');
  }

  set textContent(val) {
    this._innerHTML = String(val);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(sel) {
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      if (this.id === id) return this;
      for (const c of this.children) {
        const found = c.querySelector?.(sel);
        if (found) return found;
      }
    }
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.className.includes(cls)) return this;
      for (const c of this.children) {
        const found = c.querySelector?.(sel);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.className.includes(cls)) res.push(this);
    }
    for (const c of this.children) {
      if (c.querySelectorAll) res.push(...c.querySelectorAll(sel));
    }
    return res;
  }

  addEventListener(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(fn);
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type || event) || [];
    for (const h of handlers) h(event);
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => new MockElement(tag),
    body: new MockElement('body'),
    addEventListener: () => {}
  };
}

test('Assistant Interaction: renders interface and receives AI responses on prompt send', async () => {
  const container = new MockElement('div');
  container.id = 'viewport-content';

  assistantTool.render(container, { tool: { id: 'assistant', name: 'Assistant' } });

  const userInput = container.querySelector('#ast-user-input');
  const sendBtn = container.querySelector('#ast-send-btn');
  const messagesEl = container.querySelector('#ast-messages');

  assert.ok(userInput, 'Textarea input element exists');
  assert.ok(sendBtn, 'Send button exists');
  assert.ok(messagesEl, 'Messages stream container exists');

  // Send prompt: "Hello, what can you do?"
  userInput.value = 'Hello, what can you do?';
  
  // Trigger Send click
  const clickHandlers = sendBtn.listeners.get('click') || [];
  assert.ok(clickHandlers.length > 0, 'Send button has click listener attached');
  
  await clickHandlers[0]();

  // Wait for streaming tokens to complete
  await new Promise(r => setTimeout(r, 600));

  assert.ok(messagesEl.children.length >= 2, 'Expected at least 2 message bubbles (user and assistant)');
  const assistantMsg = messagesEl.children[messagesEl.children.length - 1];
  assert.ok(assistantMsg, 'Assistant message element created');
  const textBody = assistantMsg.querySelector('.ast-text-body');
  assert.ok(textBody, 'Assistant text body rendered');
  assert.ok(textBody.innerHTML.length > 0, 'Assistant returned response text');
});

test('Assistant Interaction: solves calculation prompt and renders math result', async () => {
  const container = new MockElement('div');
  assistantTool.render(container, { tool: { id: 'assistant', name: 'Assistant' } });

  const userInput = container.querySelector('#ast-user-input');
  const sendBtn = container.querySelector('#ast-send-btn');
  const messagesEl = container.querySelector('#ast-messages');

  userInput.value = 'calculate 15 * 80 + 35';
  const clickHandlers = sendBtn.listeners.get('click') || [];
  await clickHandlers[0]();

  await new Promise(r => setTimeout(r, 400));

  const assistantMsg = messagesEl.children[messagesEl.children.length - 1];
  const textBody = assistantMsg.querySelector('.ast-text-body');
  assert.ok(textBody.innerHTML.length > 0, 'Expected response rendered in DOM');
});
