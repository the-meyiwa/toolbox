import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSettings, getSetting, updateSettings, resetSettings, importSettings, DEFAULT_SETTINGS } from '../../js/lib/settings.js';
import { PROFILE_PICTURES, getProfilePictureSrc, getUserAvatarHtml } from '../../js/lib/profile-pictures.js';

test('Settings: initial default values match specification', () => {
  const current = getSettings();
  assert.equal(typeof current, 'object');
  assert.equal(current.autoSave, true);
  assert.equal(current.unitSystem, 'metric');
  assert.equal(current.editorWrap, false);
  assert.equal(current.editorFontSize, 13);
  assert.equal(current.hapticAudio, true);
  assert.equal(current.displayName, '');
  assert.equal(current.profilePicture, 'default');
});

test('Settings: updateSettings mutates settings and returns updated object', () => {
  updateSettings({ unitSystem: 'imperial', editorFontSize: 16, displayName: 'Ada', profilePicture: 'adalovelace.jpg' });
  assert.equal(getSetting('unitSystem'), 'imperial');
  assert.equal(getSetting('editorFontSize'), 16);
  assert.equal(getSetting('displayName'), 'Ada');
  assert.equal(getSetting('profilePicture'), 'adalovelace.jpg');

  // Reset back
  resetSettings();
  assert.equal(getSetting('unitSystem'), 'metric');
  assert.equal(getSetting('editorFontSize'), 13);
  assert.equal(getSetting('displayName'), '');
  assert.equal(getSetting('profilePicture'), 'default');
});

test('Settings: importSettings validates JSON schema', () => {
  const goodJson = JSON.stringify({ unitSystem: 'imperial', editorWrap: true });
  const res = importSettings(goodJson);
  assert.equal(res.success, true);
  assert.equal(getSetting('unitSystem'), 'imperial');
  assert.equal(getSetting('editorWrap'), true);

  const badJson = 'invalid json string';
  const badRes = importSettings(badJson);
  assert.equal(badRes.success, false);

  // Clean up
  resetSettings();
});

test('Profile Pictures: registry includes minimal silhouette and all picture options', () => {
  assert.equal(PROFILE_PICTURES.length, 20);
  const defaultPic = PROFILE_PICTURES.find(p => p.id === 'default');
  assert.ok(defaultPic, 'Default minimal silhouette must exist');
  assert.equal(defaultPic.src, null);

  const expectedIds = [
    'Lara.jpg', 'Tanya.jpg', 'adalovelace.jpg', 'beethoven.jpg', 'burnaboy.jpg',
    'cr7.jpg', 'davido.jpg', 'donald.jpg', 'elon.jpg', 'ezio.jpg',
    'khabylame.jpg', 'kratos.jpg', 'messi.jpg', 'miakhalifa.jpg', 'mrbeast.jpg',
    'scorpion.jpg', 'tinubu.jpg', 'triborg.jpg', 'v.jpg'
  ];

  for (const id of expectedIds) {
    const found = PROFILE_PICTURES.find(p => p.id === id);
    assert.ok(found, `Profile picture "${id}" must exist in registry`);
    assert.equal(found.src, `/profile-pictures/${id}`);
    assert.equal(getProfilePictureSrc(id), `/profile-pictures/${id}`);
  }
});

test('Profile Pictures: getUserAvatarHtml renders SVG for default and img for picture id', () => {
  const defaultHtml = getUserAvatarHtml('default', 40);
  assert.ok(defaultHtml.includes('<svg'), 'Default must render SVG icon');
  assert.ok(defaultHtml.includes('viewBox="0 0 24 24"'));

  const laraHtml = getUserAvatarHtml('Lara.jpg', 48);
  assert.ok(laraHtml.includes('<img'), 'Image id must render <img> tag');
  assert.ok(laraHtml.includes('/profile-pictures/Lara.jpg'));

  // Zero emojis in avatar html
  const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
  assert.equal(emojiRegex.test(defaultHtml), false);
  assert.equal(emojiRegex.test(laraHtml), false);
});

