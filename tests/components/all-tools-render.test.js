/* ============================================================
   All 109 Tools Lifecycle & Component Render Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { TOOLS, BY_ID } from '../../js/registry/index.js';

// Setup DOM globals
const { document } = setupDOMEnvironment();

const mockAnalytics = {
  started: () => {},
  completed: () => {},
  copied: () => {},
  downloaded: () => {},
  error: () => {},
  viewed: () => {},
};

test('All Tools: every tool in registry has a valid module and clean lifecycle', { timeout: 60000 }, async (t) => {
  for (const tool of TOOLS) {
    await t.test(`Tool [${tool.id}] ("${tool.name}")`, async () => {
      // 1. Import module
      const modulePath = `../../js/tools/${tool.id}.js`;
      let toolModule;
      try {
        toolModule = await import(modulePath);
      } catch (err) {
        assert.fail(`Failed to import tool module ${modulePath}: ${err.message}`);
      }

      const instance = toolModule.default || toolModule;
      assert.ok(instance, `Tool ${tool.id} exports no default object`);
      assert.equal(typeof instance.render, 'function', `Tool ${tool.id} missing render() method`);

      // 2. Setup container
      const container = document.createElement('div');
      container.id = `test-container-${tool.id}`;
      document.body.appendChild(container);

      // 3. Render tool
      try {
        await instance.render(container, {
          analytics: mockAnalytics,
          tool,
          artifact: null,
        });
      } catch (err) {
        assert.fail(`Tool ${tool.id} threw error during render(): ${err.stack || err.message}`);
      }

      // 4. Assert DOM is rendered
      assert.ok(container.childNodes.length > 0, `Tool ${tool.id} rendered nothing to the DOM container`);

      // 5. Test artifact production if declared
      if (tool.produces && tool.produces.length > 0 && typeof instance.getArtifact === 'function') {
        try {
          const artifact = instance.getArtifact();
          if (artifact) {
            assert.ok(artifact.kind, `Tool ${tool.id} getArtifact() returned no kind`);
            assert.ok(tool.produces.includes(artifact.kind), `Tool ${tool.id} produced kind "${artifact.kind}" not listed in registry produces [${tool.produces.join(', ')}]`);
            assert.ok(typeof artifact.text === 'string' || artifact.data != null, `Tool ${tool.id} getArtifact() returned no text/data content`);
          }
        } catch (err) {
          assert.fail(`Tool ${tool.id} getArtifact() threw: ${err.message}`);
        }
      }

      // 6. Test artifact consumption if declared
      if (tool.accepts && tool.accepts.length > 0 && typeof instance.setArtifact === 'function') {
        try {
          const sampleKind = tool.accepts[0];
          instance.setArtifact({
            id: 'art_test',
            name: `sample.${sampleKind}`,
            kind: sampleKind,
            text: sampleKind === 'json' ? '{"test": 123}' : (sampleKind === 'csv' ? 'a,b\n1,2' : 'Test content for tool'),
            from: 'test',
          });
        } catch (err) {
          assert.fail(`Tool ${tool.id} setArtifact() threw: ${err.message}`);
        }
      }

      // 7. Simulate input interactions (find first input/textarea and trigger)
      const input = container.querySelector('input:not([type="hidden"]), textarea');
      if (input) {
        try {
          if (input.type === 'number') input.value = '100';
          else if (input.type === 'text' || input.tagName === 'TEXTAREA') input.value = 'Test input';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {
          assert.fail(`Tool ${tool.id} threw error on input event: ${err.message}`);
        }
      }

      // 8. Test destruction and resource cleanup
      if (typeof instance.destroy === 'function') {
        try {
          instance.destroy();
        } catch (err) {
          assert.fail(`Tool ${tool.id} destroy() threw error: ${err.message}`);
        }
      }

      // Cleanup DOM
      container.remove();
    });
  }
});
