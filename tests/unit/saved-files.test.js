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

test('Files View: icon system recognizes categories and renders SVGs without emojis', async () => {
  const { detectFileCategory, getFileTypeIcon } = await import('../../js/lib/file-icons.js');

  const testCases = [
    { name: 'document.pdf', kind: 'pdf', expected: 'pdf' },
    { name: 'sheet.xlsx', kind: 'csv', expected: 'spreadsheet' },
    { name: 'data.csv', kind: 'csv', expected: 'spreadsheet' },
    { name: 'report.docx', kind: 'text', expected: 'document' },
    { name: 'slides.pptx', kind: 'presentation', expected: 'presentation' },
    { name: 'photo.jpg', kind: 'image', expected: 'image' },
    { name: 'schema.json', kind: 'json', expected: 'json' },
    { name: 'script.js', kind: 'code', expected: 'code' },
    { name: 'song.mp3', kind: 'audio', expected: 'audio' },
    { name: 'clip.mp4', kind: 'video', expected: 'video' },
    { name: 'backup.zip', kind: 'archive', expected: 'archive' },
    { name: 'notes.md', kind: 'markdown', expected: 'markdown' },
    { name: 'readme.txt', kind: 'text', expected: 'text' },
    { name: 'my-folder', kind: 'folder', expected: 'folder' },
    { name: 'unknown.xyz', kind: 'unknown', expected: 'generic' },
  ];

  for (const tc of testCases) {
    const cat = detectFileCategory(tc.name, tc.kind);
    assert.equal(cat, tc.expected, `Expected ${tc.name} to map to ${tc.expected}, got ${cat}`);

    const iconSvg = getFileTypeIcon(tc.name, tc.kind, 24);
    assert.ok(iconSvg.includes('<svg'), `Icon for ${tc.name} must be an SVG`);
    assert.ok(iconSvg.includes('file-icon-'), `Icon for ${tc.name} must contain file-icon- class`);
    // Ensure no emoji
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
    assert.equal(emojiRegex.test(iconSvg), false, `Icon for ${tc.name} must not contain emojis`);
  }
});

test('Files View: items are draggable for drag-and-drop re-organization and upload', () => {
  const host = document.createElement('div');
  const unmount = renderSaved(host);

  // Check that item rows/icons have draggable="true"
  const draggableElements = host.querySelectorAll('[draggable="true"]');
  assert.ok(draggableElements.length > 0, 'Files items must be marked draggable for drag-and-drop');

  // Verify excess buttons that duplicate context menu actions are removed
  assert.equal(host.querySelector('.sv-detail-pane [data-act="export-one"]'), null, 'Redundant download button must be removed from detail pane');
  assert.equal(host.querySelector('.sv-detail-pane [data-act="delete"]'), null, 'Redundant delete button must be removed from detail pane');
  assert.equal(host.querySelector('[data-act="compress-current"]'), null, 'Redundant zip button must be removed from folder toolbar');

  unmount();
});

test('Files View: getToolsForFile dynamically recommends tools based on file type and registry capabilities', async () => {
  const { getToolsForFile } = await import('../../js/views/saved.js');

  const cases = [
    { file: { name: 'photo.png' }, expectedId: 'image-compressor' },
    { file: { name: 'document.pdf' }, expectedId: 'pdf-editor' },
    { file: { name: 'sales.csv' }, expectedId: 'csv-to-json' },
    { file: { name: 'readme.md' }, expectedId: 'markdown-preview' },
    { file: { name: 'config.json' }, expectedId: 'json-formatter' },
    { file: { name: 'app.js' }, expectedId: 'code-playground' },
    { file: { name: 'bundle.zip' }, expectedId: 'file-decompressor' },
  ];

  for (const tc of cases) {
    const tools = getToolsForFile(tc.file);
    assert.ok(Array.isArray(tools), `Tools for ${tc.file.name} must be an array`);
    assert.ok(tools.length > 0, `Tools for ${tc.file.name} should not be empty`);
    assert.ok(
      tools.some(t => t.id === tc.expectedId),
      `Tools for ${tc.file.name} should include '${tc.expectedId}', got ${tools.map(t => t.id).join(', ')}`
    );
    // Ensure all returned items are valid Tool objects with id, name, and description
    for (const t of tools) {
      assert.ok(t.id, 'Tool item must have an id');
      assert.ok(t.name, 'Tool item must have a name');
      assert.notEqual(t.name, '[object Object]', 'Tool name must never be [object Object]');
    }
  }
});

test('Files View: Open in… popup menu toggles, renders rich items, and avoids [object Object]', () => {
  for (const item of artifacts.list()) artifacts.remove(item.id);

  const doc = artifacts.save({
    name: 'architecture.md',
    kind: 'markdown',
    text: '# Architecture\nDetailed plan here.',
    from: 'markdown-preview'
  });

  const host = document.createElement('div');
  const unmount = renderSaved(host, doc.id);

  // Strict check: No "[object Object]" anywhere in the rendered HTML
  assert.equal(host.innerHTML.includes('[object Object]'), false, 'Files UI must never contain "[object Object]"');

  // Verify dropdown toggle exists with proper attributes
  const toggleBtn = host.querySelector('#sv-open-dropdown-toggle');
  assert.ok(toggleBtn, 'Open in… toggle button must exist in detail pane');
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false');
  assert.ok(toggleBtn.textContent.includes('Open in…'));

  // Verify dropdown menu starts hidden
  const menu = host.querySelector('#sv-open-dropdown-menu');
  assert.ok(menu, 'Open in… dropdown menu must exist');
  assert.ok(menu.hidden, 'Open in… dropdown menu must be hidden by default');

  // Verify menu items are present with icons and descriptions
  const menuItems = host.querySelectorAll('.sv-open-menu-item');
  assert.ok(menuItems.length > 0, 'Open in… menu must have at least one tool option for markdown');
  const firstItem = menuItems[0];
  assert.ok(firstItem.classList.contains('sv-open-btn'), 'Menu item must have .sv-open-btn class for routing integration');
  assert.ok(firstItem.dataset.open, 'Menu item must have data-open attribute');
  assert.ok(firstItem.querySelector('strong'), 'Menu item must have bold tool name');

  // Click toggle to open
  toggleBtn.click();
  assert.equal(menu.hidden, false, 'Dropdown menu should be visible after clicking toggle');
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'true');

  // Click toggle to close
  toggleBtn.click();
  assert.equal(menu.hidden, true, 'Dropdown menu should be hidden after second toggle click');
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false');

  unmount();
  artifacts.remove(doc.id);
});

test('Files View: Search empty state shows clear button and restores search on click', () => {
  for (const item of artifacts.list()) artifacts.remove(item.id);

  artifacts.save({
    name: 'project_notes.txt',
    kind: 'text',
    text: 'Important project details',
    from: 'code-playground'
  });

  const host = document.createElement('div');
  const unmount = renderSaved(host);

  const searchBox = host.querySelector('#sv-search-box');
  assert.ok(searchBox, 'Search box must exist');

  // Type non-matching search
  searchBox.value = 'zz_non_existent_file_query_12345';
  searchBox.dispatchEvent(new Event('input', { bubbles: true }));

  // Confirm empty search state is displayed
  const clearBtn = host.querySelector('#sv-clear-search');
  assert.ok(clearBtn, 'Clear search button must be rendered in empty search state');
  assert.ok(host.textContent.includes('zz_non_existent_file_query_12345'));

  // Click clear search
  clearBtn.click();
  const refreshedBox = host.querySelector('#sv-search-box');
  assert.equal(refreshedBox.value, '', 'Search box input should be cleared');
  assert.equal(host.querySelector('#sv-clear-search'), null, 'Clear search button should disappear after clearing');

  unmount();
});

