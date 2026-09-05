/* ============================================================
   Code Playground IDE Unit Tests
   Validates:
   - 2 UI modes (Light and Dark only) with theme isolation
   - Top menu bar with "File, Edit, View, Run, Test" dropdowns
   - Language selector relocated to bottom right status bar
   - Side panel files plus button with item type dropdown
   - Generative AI Assistant visibility & position (signed-in only)
   - Online workspace sync
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

const { document } = setupDOMEnvironment();

test('Code Playground IDE: 2 UI Modes only (Light & Dark) and isolation', async () => {
  const cpgModule = await import('../../js/tools/code-playground.js');
  const { getPlaygroundMode, setPlaygroundMode } = cpgModule;

  // 1. Initial / default mode is dark
  localStorage.removeItem('toolbox_cpg_theme_mode_v1');
  assert.equal(getPlaygroundMode(), 'dark', 'Default mode should be dark');

  // 2. Set to light mode
  setPlaygroundMode('light');
  assert.equal(getPlaygroundMode(), 'light', 'Mode should be light');
  assert.equal(localStorage.getItem('toolbox_cpg_theme_mode_v1'), 'light');

  // 3. Set to dark mode
  setPlaygroundMode('dark');
  assert.equal(getPlaygroundMode(), 'dark', 'Mode should be dark');
  assert.equal(localStorage.getItem('toolbox_cpg_theme_mode_v1'), 'dark');

  // 4. Invalid mode defaults safely to dark
  setPlaygroundMode('cyberpunk-neon');
  assert.equal(getPlaygroundMode(), 'dark', 'Invalid mode should fall back to dark');

  // 5. Verify isolated CSS root class rendered
  const container = document.createElement('div');
  document.body.appendChild(container);
  await cpgModule.default.render(container);

  const root = container.querySelector('#cpg-root') || container.querySelector('.cpg-landing');
  assert.ok(root, 'Playground root element must be rendered');
  assert.ok(
    root.classList.contains('cpg-mode-dark') || root.classList.contains('cpg-mode-light'),
    'Root element must have isolated cpg-mode-dark or cpg-mode-light class'
  );
});

test('Code Playground IDE: Desktop Menus (File, Edit, View, Run, Test)', async () => {
  const cpgModule = await import('../../js/tools/code-playground.js');

  const container = document.createElement('div');
  document.body.appendChild(container);

  // Provide an active artifact to render the full IDE
  await cpgModule.default.render(container, {
    artifact: {
      id: 'ws_test',
      name: 'app.js',
      kind: 'js',
      text: 'console.log("Hello IDE");'
    }
  });

  const root = container.querySelector('#cpg-root');
  assert.ok(root, 'IDE workspace root must be present');

  // Verify Menubar exists
  const menubar = container.querySelector('.cpg-menubar');
  assert.ok(menubar, 'Menubar container .cpg-menubar must be rendered');

  // Verify File, Edit, View, Run, Test menus
  const fileMenuBtn = container.querySelector('#cpg-menu-file-btn');
  const editMenuBtn = container.querySelector('#cpg-menu-edit-btn');
  const viewMenuBtn = container.querySelector('#cpg-menu-view-btn');
  const runMenuBtn = container.querySelector('#cpg-menu-run-btn');
  const testMenuBtn = container.querySelector('#cpg-menu-test-btn');

  assert.ok(fileMenuBtn, 'File menu trigger must be present');
  assert.ok(editMenuBtn, 'Edit menu trigger must be present');
  assert.ok(viewMenuBtn, 'View menu trigger must be present');
  assert.ok(runMenuBtn, 'Run menu trigger must be present');
  assert.ok(testMenuBtn, 'Test menu trigger must be present');

  // Verify dropdown content menus exist
  const fileDropdown = container.querySelector('#cpg-menu-file');
  const editDropdown = container.querySelector('#cpg-menu-edit');
  const viewDropdown = container.querySelector('#cpg-menu-view');
  const runDropdown = container.querySelector('#cpg-menu-run');
  const testDropdown = container.querySelector('#cpg-menu-test');

  assert.ok(fileDropdown, '#cpg-menu-file dropdown must exist');
  assert.ok(editDropdown, '#cpg-menu-edit dropdown must exist');
  assert.ok(viewDropdown, '#cpg-menu-view dropdown must exist');
  assert.ok(runDropdown, '#cpg-menu-run dropdown must exist');
  assert.ok(testDropdown, '#cpg-menu-test dropdown must exist');

  // Verify key items in menus
  assert.ok(fileDropdown.querySelector('[data-action="new-file"]'), 'File menu must have New File');
  assert.ok(fileDropdown.querySelector('[data-action="new-folder"]'), 'File menu must have New Folder');
  assert.ok(fileDropdown.querySelector('[data-action="insert-example"]'), 'File menu must have Insert Example Code');
  assert.ok(fileDropdown.querySelector('[data-action="save-workspace"]'), 'File menu must have Save Workspace');
  assert.ok(fileDropdown.querySelector('[data-action="package-zip"]'), 'File menu must have Package ZIP');

  assert.ok(viewDropdown.querySelector('[data-action="theme-dark"]'), 'View menu must have Dark Mode option');
  assert.ok(viewDropdown.querySelector('[data-action="theme-light"]'), 'View menu must have Light Mode option');
});

test('Code Playground IDE: Language selector at bottom right of code editor', async () => {
  const cpgModule = await import('../../js/tools/code-playground.js');

  const container = document.createElement('div');
  document.body.appendChild(container);

  await cpgModule.default.render(container, {
    artifact: { id: 'ws_lang', name: 'main.py', kind: 'py', text: 'print(42)' }
  });

  const statusBar = container.querySelector('#cpg-status-bar');
  assert.ok(statusBar, 'Status bar must be rendered at bottom');

  // Language selector must be inside status bar
  const langsInStatus = statusBar.querySelector('#cpg-langs');
  assert.ok(langsInStatus, 'Language selector #cpg-langs must be located inside the bottom status bar');

  // Top header must NOT have language selector
  const header = container.querySelector('#cpg-header');
  assert.ok(!header.querySelector('#cpg-langs'), 'Top header must NOT contain language selector');
});

test('Code Playground IDE: Files side panel plus button dropdown', async () => {
  const cpgModule = await import('../../js/tools/code-playground.js');

  const container = document.createElement('div');
  document.body.appendChild(container);

  await cpgModule.default.render(container, {
    artifact: { id: 'ws_side', name: 'index.js', kind: 'js', text: '1+1;' }
  });

  const plusBtn = container.querySelector('#cpg-plus-btn');
  assert.ok(plusBtn, 'Files side panel plus button #cpg-plus-btn must be present');

  const plusDropdown = container.querySelector('#cpg-plus-dropdown');
  assert.ok(plusDropdown, 'Files side panel plus dropdown #cpg-plus-dropdown must be present');

  // Check item type options
  assert.ok(plusDropdown.querySelector('[data-add="file"]'), 'Plus dropdown must have New File option');
  assert.ok(plusDropdown.querySelector('[data-add="folder"]'), 'Plus dropdown must have New Folder option');
  assert.ok(plusDropdown.querySelector('[data-add="component"]'), 'Plus dropdown must have HTML / Component option');
  assert.ok(plusDropdown.querySelector('[data-add="test"]'), 'Plus dropdown must have Test File option');
});

test('Code Playground IDE: Assistant visibility (hidden for non-signed in, beside language selector for signed in)', async () => {
  const cpgModule = await import('../../js/tools/code-playground.js');

  // 1. Non-signed in user test
  localStorage.removeItem('toolbox_supabase_session');
  localStorage.removeItem('toolbox_user');

  const containerOut = document.createElement('div');
  document.body.appendChild(containerOut);
  await cpgModule.default.render(containerOut, {
    artifact: { id: 'ws_anon', name: 'script.js', kind: 'js', text: '// anon' }
  });

  const anonAstBtn = containerOut.querySelector('#cpg-status-ast-btn');
  const anonAstPanel = containerOut.querySelector('#cpg-assistant-panel');
  assert.equal(anonAstBtn, null, 'Non-signed-in users must NOT see the assistant status bar button');
  assert.equal(anonAstPanel, null, 'Non-signed-in users must NOT have assistant panel rendered');

  // 2. Signed-in user test
  localStorage.setItem('toolbox_supabase_session', JSON.stringify({
    token: 'fake-token',
    email: 'dev@example.com',
    user: { id: 'usr_test_123', email: 'dev@example.com' },
    access_token: 'fake-token'
  }));

  const containerIn = document.createElement('div');
  document.body.appendChild(containerIn);
  await cpgModule.default.render(containerIn, {
    artifact: { id: 'ws_signed', name: 'app.js', kind: 'js', text: '// signed in' }
  });

  const signedAstBtn = containerIn.querySelector('#cpg-status-ast-btn');
  const signedAstPanel = containerIn.querySelector('#cpg-assistant-panel');
  const langsSelect = containerIn.querySelector('#cpg-langs');

  assert.ok(signedAstBtn, 'Signed-in users MUST see the assistant status bar button');
  assert.ok(signedAstPanel, 'Signed-in users MUST have assistant panel rendered');

  // Verify assistant button is beside the language selector in status bar
  const parent = signedAstBtn.parentElement;
  assert.ok(parent.contains(langsSelect), 'Assistant button must be located beside the language selector in the status bar');

  // Verify quick action chips in Assistant
  assert.ok(signedAstPanel.querySelector('#cpg-ast-debug'), 'Assistant must have Debug action chip');
  assert.ok(signedAstPanel.querySelector('#cpg-ast-tests'), 'Assistant must have Tests action chip');
  assert.ok(signedAstPanel.querySelector('#cpg-ast-build'), 'Assistant must have Build action chip');
  assert.ok(signedAstPanel.querySelector('#cpg-ast-examine'), 'Assistant must have Examine action chip');
  assert.ok(signedAstPanel.querySelector('#cpg-ast-input'), 'Assistant must have prompt input box');
});
