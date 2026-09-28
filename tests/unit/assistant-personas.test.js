import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { PERSONAS, personaChoices, personaInstruction } = await import('../../js/lib/assistant/personas.js');
const { PROFILE_PICTURES } = await import('../../js/lib/profile-pictures.js');
const { DEFAULT_SETTINGS } = await import('../../js/lib/settings.js');

test('Personas: every personality belongs to a real avatar, with a picture and a voice', () => {
  const avatarIds = new Set(PROFILE_PICTURES.map(p => p.id));
  for (const [id, p] of Object.entries(PERSONAS)) {
    assert.ok(avatarIds.has(id), `${id} is not an avatar`);
    assert.ok(p.tagline && p.voice.length > 40, `${id} needs a tagline and a real voice`);
  }
  const choices = personaChoices();
  assert.ok(choices.length >= 20);
  for (const c of choices) assert.ok(c.src && c.name && c.tagline);
});

test('Personas: politicians and adult performers have no personality', () => {
  const ids = personaChoices().map(c => c.id);
  for (const id of ['miakhalifa.jpg', 'tiabillinger.jpg', 'tinubu.jpg', 'donald.jpg']) {
    assert.ok(!ids.includes(id), id);
    assert.equal(personaInstruction(id), '');
  }
});

test('Personas: the voice never overrides facts or tools, and Standard adds nothing', () => {
  const text = personaInstruction('cr7.jpg');
  assert.match(text, /Ronaldo/);
  assert.match(text, /voice only/i);
  assert.match(text, /never claim to be them/);
  assert.match(text, /never let the voice change facts, tool results, figures, safety advice/);
  assert.equal(personaInstruction(''), '');
  assert.equal(personaInstruction('not-an-avatar.jpg'), '');
});

test('Assistant settings: Standard voice and pop-up on by default', () => {
  assert.equal(DEFAULT_SETTINGS.assistantPersona, '');
  assert.equal(DEFAULT_SETTINGS.assistantPopup, true);
});
