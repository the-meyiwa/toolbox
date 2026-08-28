import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSettings, getSetting, updateSettings, resetSettings, importSettings, DEFAULT_SETTINGS } from '../../js/lib/settings.js';

test('Settings: initial default values match specification', () => {
  const current = getSettings();
  assert.equal(typeof current, 'object');
  assert.equal(current.autoSave, true);
  assert.equal(current.unitSystem, 'metric');
  assert.equal(current.editorWrap, false);
  assert.equal(current.editorFontSize, 13);
  assert.equal(current.hapticAudio, true);
});

test('Settings: updateSettings mutates settings and returns updated object', () => {
  updateSettings({ unitSystem: 'imperial', editorFontSize: 16 });
  assert.equal(getSetting('unitSystem'), 'imperial');
  assert.equal(getSetting('editorFontSize'), 16);

  // Reset back
  resetSettings();
  assert.equal(getSetting('unitSystem'), 'metric');
  assert.equal(getSetting('editorFontSize'), 13);
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
