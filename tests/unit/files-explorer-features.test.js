import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

const { document, window } = setupDOMEnvironment();
const { getUsernameChangeStatus } = await import('../../js/lib/supabase.js');
const { fs, normalizePath } = await import('../../js/lib/filesystem.js');
const { renderSaved } = await import('../../js/views/saved.js');
const artifacts = await import('../../js/lib/artifacts.js');

test('Username 7-day Rate Limit: getUsernameChangeStatus checks cooldown correctly', () => {
  // 1. User has never changed username
  const statusNever = getUsernameChangeStatus({
    id: 'user-1',
    user_metadata: {}
  });
  assert.equal(statusNever.canChange, true);
  assert.equal(statusNever.message, '');

  // 2. User changed username 2 days ago (on cooldown)
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const statusCooldown = getUsernameChangeStatus({
    id: 'user-2',
    user_metadata: { username_changed_at: twoDaysAgo }
  });
  assert.equal(statusCooldown.canChange, false);
  assert.ok(statusCooldown.message.includes('once a week'));
  assert.ok(statusCooldown.daysRemaining > 0);

  // 3. User changed username 8 days ago (cooldown expired)
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const statusExpired = getUsernameChangeStatus({
    id: 'user-3',
    user_metadata: { username_changed_at: eightDaysAgo }
  });
  assert.equal(statusExpired.canChange, true);
  assert.equal(statusExpired.message, '');
});

test('Files View: renders Cut, Copy, Paste, Delete buttons and Select All, Properties', async () => {
  // Set up files in filesystem
  await fs.writeFile('/Home/test-doc.txt', 'Hello world');

  const host = document.createElement('div');
  const unmount = renderSaved(host);

  // Toolbar operation buttons
  const cutBtn = host.querySelector('[data-act="cut"]');
  const copyBtn = host.querySelector('[data-act="copy"]');
  const pasteBtn = host.querySelector('[data-act="paste"]');
  const deleteBtn = host.querySelector('[data-act="delete-selected"]');

  assert.ok(cutBtn, 'Cut button must exist in toolbar');
  assert.ok(copyBtn, 'Copy button must exist in toolbar');
  assert.ok(pasteBtn, 'Paste button must exist in toolbar');
  assert.ok(deleteBtn, 'Delete button must exist in toolbar');

  // Breadcrumb folder buttons
  const selectAllBtn = host.querySelector('[data-act="select-all"]');
  const propBtn = host.querySelector('[data-act="folder-properties"]');

  assert.ok(selectAllBtn, 'Select All button must exist in breadcrumb bar');
  assert.ok(propBtn, 'Folder Properties button must exist in breadcrumb bar');

  // Verify canvas attribute
  const canvasEl = host.querySelector('[data-canvas="true"]');
  assert.ok(canvasEl, 'Canvas area must be tagged with data-canvas="true"');

  unmount();
});

test('Files View: Quick Look preview opens on Preview button click', async () => {
  await fs.writeFile('/Home/quicklook-test.txt', 'Preview Content Here');

  const host = document.createElement('div');
  const unmount = renderSaved(host, '/Home/quicklook-test.txt');

  const qlBtn = host.querySelector('[data-act="quicklook"]');
  assert.ok(qlBtn, 'Preview button must exist in file detail pane');

  qlBtn.click();

  const qlModal = document.getElementById('sv-quicklook-modal');
  assert.ok(qlModal, 'Quick Look modal must open in DOM');
  assert.ok(qlModal.textContent.includes('quicklook-test.txt'));
  assert.ok(qlModal.textContent.includes('Preview Content Here'));

  // Close Quick Look modal
  const closeBtn = qlModal.querySelector('#sv-ql-close');
  assert.ok(closeBtn, 'Close button must exist in Quick Look modal');
  closeBtn.click();

  assert.equal(document.getElementById('sv-quicklook-modal'), null, 'Modal should be removed on close');

  unmount();
});

test('Files View: Directory Properties modal calculates contents and displays stats', async () => {
  await fs.mkdir('/Home/TestFolder');
  await fs.writeFile('/Home/TestFolder/f1.txt', '12345');
  await fs.writeFile('/Home/TestFolder/f2.txt', '67890');

  const host = document.createElement('div');
  const unmount = renderSaved(host);

  const propBtn = host.querySelector('[data-act="folder-properties"]');
  assert.ok(propBtn);
  propBtn.click();

  const propModal = document.getElementById('sv-properties-modal');
  assert.ok(propModal, 'Properties modal must open in DOM');
  assert.ok(propModal.textContent.includes('Properties'));
  assert.ok(propModal.textContent.includes('Contains'));
  assert.ok(propModal.textContent.includes('Total Size'));

  const closeBtn = propModal.querySelector('#sv-prop-close');
  assert.ok(closeBtn);
  closeBtn.click();

  assert.equal(document.getElementById('sv-properties-modal'), null, 'Properties modal should close');

  unmount();
});

test('Files View: Canvas Context Menu opens on right-click on blank canvas', async () => {
  const host = document.createElement('div');
  const unmount = renderSaved(host);

  const canvas = host.querySelector('.sv-split-master[data-canvas="true"]') || host.querySelector('[data-canvas="true"]');
  assert.ok(canvas);

  const ctxEvent = new window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 150,
    clientY: 200
  });
  canvas.dispatchEvent(ctxEvent);

  const menu = document.getElementById('sv-finder-menu');
  assert.ok(menu, 'Canvas context menu must appear on right click on canvas');
  assert.ok(menu.querySelector('[data-canvas-act="select-all"]'), 'Menu must have Select All option');
  assert.ok(menu.querySelector('[data-canvas-act="properties"]'), 'Menu must have Properties option');
  assert.ok(menu.querySelector('[data-canvas-act="new-folder"]'), 'Menu must have New Folder option');

  menu.remove();
  unmount();
});
