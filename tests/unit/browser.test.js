import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { TOOLS, categorised, popular, resolveId, BY_ID } from '../../js/registry/index.js';
import { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool } from '../../js/lib/assistant-tools.js';

setupDOMEnvironment();

test('Browser Tool Registry: registered with hidden flag and resolves correctly', () => {
  const browserTool = BY_ID.get('browser');
  assert.ok(browserTool, 'Browser tool must exist in registry');
  assert.equal(browserTool.id, 'browser');
  assert.equal(browserTool.name, 'Browser');
  assert.equal(browserTool.hidden, true, 'Browser tool must be hidden from public tool grid');

  // Must NOT appear in public categorized tool groups
  const catGroups = categorised(TOOLS);
  const foundInCategories = catGroups.some(c => c.tools.some(t => t.id === 'browser'));
  assert.equal(foundInCategories, false, 'Hidden browser tool must NOT be in public category listings');

  // Must NOT appear in popular shortcut row
  const popularTools = popular(10);
  const foundInPopular = popularTools.some(t => t.id === 'browser');
  assert.equal(foundInPopular, false, 'Hidden browser tool must NOT be in popular shortcuts');

  // BUT must resolve cleanly by direct ID or hash for the Assistant and direct navigation
  const resolved = resolveId('browser');
  assert.equal(resolved.id, 'browser');
});

test('Assistant Tool browse_web: declared in function calling schema', () => {
  const decl = ASSISTANT_TOOL_DECLARATIONS.find(t => t.name === 'browse_web');
  assert.ok(decl, 'browse_web tool declaration must be registered in ASSISTANT_TOOL_DECLARATIONS');
  assert.ok(decl.parameters.properties.url, 'browse_web must accept url parameter');
  assert.ok(decl.parameters.properties.query, 'browse_web must accept query parameter');
});

test('Assistant Tool browse_web: executes search/browse and returns browser-card payload', async () => {
  const res = await executeAssistantTool('browse_web', { query: 'Web browser' });
  assert.equal(res.status, 'success');
  assert.equal(res.type, 'browser-preview');
  assert.equal(res.renderer, 'browser-card');
  assert.ok(res.url, 'Result must contain target URL');
  assert.ok(res.title, 'Result must contain title');
  assert.ok(res.excerpt, 'Result must contain summary excerpt');
});

test('BrowserCardRenderer: preserves target URL and title without Wikipedia substitution', async () => {
  const { BrowserCardRenderer, renderToolResult } = await import('../../js/lib/assistant-result-renderer.js');
  const { ToolResult } = await import('../../js/lib/assistant-message-persistence.js');

  const container = document.createElement('div');
  const mockToolResult = new ToolResult({
    toolId: 'browse_web',
    toolName: 'browse_web',
    renderer: 'browser-card',
    type: 'browser-preview',
    data: {
      url: 'https://www.containerbrick.com/',
      title: 'Container Brick | Portacabins & Conversions Nigeria',
      excerpt: 'Nigeria leading provider of container offices and conversions.',
      verified: true
    }
  });

  const el = await renderToolResult(mockToolResult, container);
  assert.ok(el, 'BrowserCardRenderer must render an element');
  const html = el.innerHTML;

  assert.ok(html.includes('https://www.containerbrick.com/'), 'Must display containerbrick.com URL');
  assert.ok(html.includes('Container Brick | Portacabins'), 'Must display containerbrick.com title');
  assert.ok(html.includes('Nigeria leading provider'), 'Must display containerbrick.com excerpt');
  assert.ok(!html.includes('en.wikipedia.org'), 'Must NEVER contain en.wikipedia.org when rendering an external site');
});

