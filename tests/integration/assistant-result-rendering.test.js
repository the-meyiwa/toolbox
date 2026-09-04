import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToolResult, selectRenderer } from '../../js/lib/assistant-result-renderer.js';
import { ConversationIntegrationManager } from '../../js/lib/assistant-integration.js';

// Setup Mock DOM Element for testing
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.style = {};
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this._textContent = '';
  }

  get textContent() {
    return this._textContent || this.children.map(c => c.textContent).join(' ');
  }

  set textContent(val) {
    this._textContent = String(val);
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    this[name] = val;
  }

  getAttribute(name) {
    return this.attributes.get(name) || this[name] || null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const c of children) {
      this.children.push(typeof c === 'string' ? new MockTextNode(c) : c);
    }
  }

  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.className.includes(cls)) return this;
    }
    for (const c of this.children) {
      if (c.querySelector) {
        const found = c.querySelector(sel);
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
}

class MockTextNode {
  constructor(val) {
    this.textContent = val;
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => new MockElement(tag),
    createElementNS: (ns, tag) => new MockElement(tag)
  };
}

test('Result Renderer Selection: selects appropriate structured renderers', () => {
  const mgr = new ConversationIntegrationManager();

  // 1. File
  const fileNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'file',
    filename: 'doc.docx',
    dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAA'
  });
  assert.equal(selectRenderer(fileNorm).id, 'file');

  // 2. Image / QR
  const imgNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'image',
    dataUrl: 'data:image/png;base64,iVBOR'
  });
  assert.equal(selectRenderer(imgNorm).id, 'image');

  // 3. Chart
  const chartNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'chart',
    chartType: 'line',
    labels: ['F0', 'F1'],
    datasets: [{ data: [0, 1] }]
  });
  assert.equal(selectRenderer(chartNorm).id, 'chart');

  // 4. Circuit
  const circuitNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'circuit',
    circuit: { nodes: [{ id: 'a', type: 'input' }], wires: [] }
  });
  assert.equal(selectRenderer(circuitNorm).id, 'circuit');

  // 5. Flowchart
  const flowNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'flowchart',
    nodes: [{ type: 'declare', name: 'x' }]
  });
  assert.equal(selectRenderer(flowNorm).id, 'flowchart');

  // 6. Code Execution
  const codeNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'code-execution',
    language: 'javascript',
    code: 'console.log("hello");',
    output: 'hello'
  });
  assert.equal(selectRenderer(codeNorm).id, 'code-execution');

  // 7. Transform
  const transNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'transform',
    operation: 'slug',
    resultText: 'hello-world'
  });
  assert.equal(selectRenderer(transNorm).id, 'transform');

  // 8. JSON
  const jsonNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'json',
    json: [{ a: 1 }]
  });
  assert.equal(selectRenderer(jsonNorm).id, 'json');
});

test('DOM Rendering: renders file download card with download link', async () => {
  const container = new MockElement('div');
  const mgr = new ConversationIntegrationManager();
  const fileNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'file',
    filename: 'converted_report.docx',
    fileSize: 12400,
    dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,XYZ'
  });

  const el = await renderToolResult(fileNorm, container);
  assert.ok(el, 'Rendered file card element');
  assert.ok(el.className.includes('assistant-result-file-card'));
  assert.ok(el.textContent.includes('converted_report.docx'));
  const btn = el.querySelector('.assistant-file-download-btn');
  assert.ok(btn, 'Contains download button');
  assert.equal(btn.getAttribute('download'), 'converted_report.docx');
});

test('DOM Rendering: renders transformation result box with clean copyable text', async () => {
  const container = new MockElement('div');
  const mgr = new ConversationIntegrationManager();
  const transNorm = mgr.normalizeToolResult({
    status: 'success',
    type: 'transform',
    operation: 'Slug Converter',
    resultText: 'my-clean-slug-url'
  });

  const el = await renderToolResult(transNorm, container);
  assert.ok(el, 'Rendered transform element');
  assert.ok(el.textContent.includes('my-clean-slug-url'));
  assert.ok(el.querySelector('.assistant-transform-copy-btn'));
});
