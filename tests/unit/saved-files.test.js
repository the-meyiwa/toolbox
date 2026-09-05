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

