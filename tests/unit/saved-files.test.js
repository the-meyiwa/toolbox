import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { renderSaved } from '../../js/views/saved.js';

const { document } = setupDOMEnvironment();
const artifacts = await import('../../js/lib/artifacts.js');

test('Files View: renders multiple viewing options (split, grid, list switcher)', () => {
  // Clear artifacts
  for (const item of artifacts.list()) artifacts.remove(item.id);

  artifacts.save({
    name: 'sales_q3.csv',
    kind: 'csv',
    text: 'region,revenue,units\nNorth,52000,120\nSouth,48000,95',
    from: 'csv-to-json'
  });

  const host = document.createElement('div');
  const unmount = renderSaved(host);

  // Check view switcher buttons exist
  assert.ok(host.querySelector('.sv-view-switcher'), 'View switcher strip must exist');
  assert.ok(host.querySelector('[data-layout="split"]'), 'Split view option must exist');
  assert.ok(host.querySelector('[data-layout="grid"]'), 'Grid view option must exist');
  assert.ok(host.querySelector('[data-layout="list"]'), 'List view option must exist');

  // Check search filter input exists
  assert.ok(host.querySelector('#sv-search-box'), 'Search filter input box must exist');

  // Check content view switcher exists in detail pane
  assert.ok(host.querySelector('.sv-content-view-switcher'), 'Content view switcher must exist');
  assert.ok(host.querySelector('[data-cview="formatted"]'), 'Formatted content view option must exist');
  assert.ok(host.querySelector('[data-cview="table"]'), 'Table content view option must exist for CSV data');
  assert.ok(host.querySelector('[data-cview="raw"]'), 'Raw content view option must exist');

  // Strict check: Verify zero emojis in rendered HTML
  const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
  assert.equal(emojiRegex.test(host.innerHTML), false, 'Files page must NOT contain any emojis');

  unmount();
});
