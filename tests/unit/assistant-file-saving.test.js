import test from 'node:test';
import assert from 'node:assert/strict';
import { saveArtifactFile, list, get } from '../../js/lib/artifacts.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { selectRenderer } from '../../js/lib/assistant-result-renderer.js';
import { ConversationIntegrationManager } from '../../js/lib/assistant-integration.js';

// Setup minimal localStorage mock for testing
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { hash: '' },
    open: () => {}
  };
}

test('saveArtifactFile: saves file to local Saved Work with correct metadata and kind', async () => {
  const res = await saveArtifactFile({
    name: 'fibonacci.py',
    content: 'def fib(n): return [0, 1]...',
    kind: 'code',
    destination: 'cloud',
    from: 'assistant'
  });

  assert.ok(res.success, 'Save was successful');
  assert.ok(res.artifact.id, 'Has artifact ID');
  assert.equal(res.artifact.name, 'fibonacci.py');
  assert.equal(res.artifact.kind, 'code');
  assert.equal(res.artifact.from, 'assistant');

  // Verify it exists in local store
  const item = get(res.artifact.id);
  assert.ok(item, 'Artifact found in store');
  assert.equal(item.text, 'def fib(n): return [0, 1]...');
});

test('saveArtifactFile: auto-detects kind from file extension', async () => {
  const res = await saveArtifactFile({
    name: 'quarterly_revenue.csv',
    content: 'Q1,100\nQ2,150\nQ3,200',
    destination: 'cloud'
  });

  assert.ok(res.success);
  assert.equal(res.artifact.kind, 'csv');
});

test('Assistant Tool save_file: executes save and returns file-saved structured result', async () => {
  const result = await executeAssistantTool('save_file', {
    filename: 'algorithm.js',
    content: 'console.log("QuickSort");',
    destination: 'cloud'
  });

  assert.equal(result.status, 'success');
  assert.equal(result.type, 'file-saved');
  assert.equal(result.renderer, 'file-saved');
  assert.equal(result.filename, 'algorithm.js');
  assert.ok(result.artifactId, 'Returned artifact ID');
});

test('Assistant Tool save_file: auto-resolves content from taskState when omitted in prompt', async () => {
  const taskState = {
    lastArtifact: {
      kind: 'csv',
      name: 'generated_data.csv',
      text: 'id,item,qty\n1,Apples,50\n2,Oranges,75'
    }
  };

  const result = await executeAssistantTool('save_file', {
    filename: 'inventory.csv'
  }, { taskState });

  assert.equal(result.status, 'success');
  assert.equal(result.type, 'file-saved');
  assert.equal(result.filename, 'inventory.csv');
  assert.equal(result.kind, 'csv');

  const saved = get(result.artifactId);
  assert.ok(saved.text.includes('Apples'));
});

test('Assistant Result Renderer: selects file-saved renderer for saved file payloads', () => {
  const mgr = new ConversationIntegrationManager();
  const normalized = mgr.normalizeToolResult({
    status: 'success',
    type: 'file-saved',
    filename: 'budget_2026.csv',
    artifactId: 'art_12345',
    destination: 'cloud',
    isCloudSynced: false
  });

  assert.equal(selectRenderer(normalized).id, 'file-saved');
});
