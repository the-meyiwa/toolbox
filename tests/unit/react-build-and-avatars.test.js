import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { PROFILE_PICTURES, getUserAvatarHtml, getProfilePictureSrc } from '../../js/lib/profile-pictures.js';
import { attachSegmentedSlider } from '../../js/lib/segmented-slider.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { renderSaved } from '../../js/views/saved.js';
import { openSettings, showAvatarView, showMainView, closeSettings } from '../../js/lib/settings-ui.js';

const { document } = setupDOMEnvironment();

test('Avatars: all 20 character personas have names and witty bios', () => {
  assert.equal(PROFILE_PICTURES.length, 20, 'Should have exactly 20 avatars (minimal silhouette + 19 characters)');
  for (const pic of PROFILE_PICTURES) {
    assert.ok(pic.id, 'Avatar must have an id');
    assert.ok(pic.name, `Avatar ${pic.id} must have a name`);
    assert.ok(pic.story && pic.story.length > 20, `Avatar ${pic.name} must have a witty story description`);
    // Verify zero emojis in character names and stories
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
    assert.equal(emojiRegex.test(pic.name), false, `Name ${pic.name} must not contain emojis`);
    assert.equal(emojiRegex.test(pic.story), false, `Story for ${pic.name} must not contain emojis`);
  }
});

test('Avatars: getUserAvatarHtml renders valid SVG / image markup without emojis', () => {
  const defaultHtml = getUserAvatarHtml('default', 48);
  assert.ok(defaultHtml.includes('svg'), 'Default avatar must include an SVG silhouette icon');

  const namedHtml = getUserAvatarHtml('Lara.jpg', 60);
  assert.ok(namedHtml.includes('img') && namedHtml.includes('Lara.jpg'), 'Named avatar must render an img element');

  const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
  assert.equal(emojiRegex.test(defaultHtml), false, 'Avatar HTML must not contain emojis');
  assert.equal(emojiRegex.test(namedHtml), false, 'Avatar HTML must not contain emojis');
});

test('Settings: dedicated avatar subpage renders all 20 cards and supports navigation', () => {
  openSettings();
  const modal = document.getElementById('settings-modal');
  assert.ok(modal, 'Settings modal must exist');

  // Navigate to avatars dedicated page
  showAvatarView();
  const avatarsView = modal.querySelector('#settings-avatars-view');
  const mainView = modal.querySelector('#settings-modal-scroll');
  const backBtn = modal.querySelector('#settings-back-btn');
  const gallery = modal.querySelector('#settings-avatar-gallery');

  assert.equal(avatarsView.style.display, 'flex', 'Avatars view must be active');
  assert.equal(mainView.style.display, 'none', 'Main settings view must be hidden');
  assert.equal(backBtn.style.display, 'inline-flex', 'Back button must be visible');

  const cards = gallery.querySelectorAll('.avatar-story-card');
  assert.equal(cards.length, 20, 'Must render cards for all 20 character personas');

  // Test back navigation
  showMainView();
  assert.equal(mainView.style.display, 'flex', 'Main settings view must be restored');
  assert.equal(avatarsView.style.display, 'none', 'Avatars view must be hidden');
  assert.equal(backBtn.style.display, 'none', 'Back button must be hidden on main view');

  closeSettings();
});

test('Files View: container is offset from navbar and switcher reads "Online"', async () => {
  const artifacts = await import('../../js/lib/artifacts.js');
  artifacts.save({
    name: 'test-document.txt',
    kind: 'text',
    text: 'Offline storage test text',
    from: 'test'
  });

  const host = document.createElement('div');
  const unmount = renderSaved(host);

  const sv = host.querySelector('.sv');
  assert.ok(sv, 'Files container .sv must exist');
  const styleStr = sv.getAttribute?.('style') || sv.style?.margin || '';
  assert.ok(styleStr.includes('18px') || styleStr.includes('20px') || parseInt(sv.style?.marginTop || '0') >= 16, 'Files container must be offset from top navbar');

  // Verify Online label doesn't contain "(Cloud)"
  const storageSwitch = host.querySelector('.sv-storage-switch');
  assert.ok(storageSwitch, 'Storage switch must exist');
  const onlineBtn = storageSwitch.querySelector('[data-storage="online"]');
  if (onlineBtn) {
    assert.equal(onlineBtn.textContent.trim(), 'Online', 'Storage switch must read "Online" without (Cloud)');
    assert.equal(onlineBtn.textContent.includes('Cloud'), false, 'Should not contain "(Cloud)"');
  }

  unmount();
});

test('Segmented Slider: attaches smoothly and inserts sliding pill', () => {
  const container = document.createElement('div');
  container.innerHTML = `
    <button class="tab-btn active">Tab 1</button>
    <button class="tab-btn">Tab 2</button>
    <button class="tab-btn">Tab 3</button>
  `;
  document.body.appendChild(container);

  const update = attachSegmentedSlider(container, '.tab-btn');
  assert.equal(typeof update, 'function', 'Should return an update function');

  const pill = container.querySelector('.segmented-slider-pill');
  assert.ok(pill, 'Should insert .segmented-slider-pill element');
  assert.equal(pill.getAttribute('aria-hidden'), 'true', 'Pill should have aria-hidden');

  container.remove();
});

test('Assistant IDE: creates React project and builds JSX without syntax failure', async () => {
  const createRes = await executeAssistantTool('ide_create_project', {
    name: 'react-unit-test-app',
    template: 'react',
    description: 'Unit test React application'
  });

  assert.equal(createRes.status, 'success', 'Project creation must succeed');
  assert.ok(createRes.files.some(f => f.includes('app.js') || f.includes('app.jsx')), 'Must create app entry');

  // Build the project
  const buildRes = await executeAssistantTool('ide_build_and_preview', {
    project_path: '/Projects/react-unit-test-app'
  });

  assert.equal(buildRes.status, 'success', `Build must succeed, got: ${JSON.stringify(buildRes)}`);
  assert.equal(buildRes.diagnostics?.length || 0, 0, 'Must have zero diagnostic errors on JSX/React build');
  assert.ok((buildRes.htmlBundle || '').includes('react@18') || (buildRes.htmlBundle || '').includes('babel'), 'Preview bundle must include React & Babel scripts for in-browser execution');
});
