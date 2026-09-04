/* ============================================================
   Space Engine & Collaboration Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();

const { getUserProfile, saveUserProfile, listJoinedSpaces, saveJoinedSpace, removeJoinedSpace, getJoinedSpace } = await import('../../js/lib/space-engine.js');

test('SpaceEngine: user profile management', () => {
  const profile = getUserProfile();
  assert.ok(profile.id);
  assert.ok(profile.color);

  const updated = saveUserProfile({ name: 'Alex Rivera' });
  assert.equal(updated.name, 'Alex Rivera');
  assert.equal(getUserProfile().name, 'Alex Rivera');
});

test('SpaceEngine: joined spaces bookmarks persistence', () => {
  const spaceCode = 'TEST99';
  saveJoinedSpace({
    id: spaceCode,
    name: 'Marketing Launch Desk',
    description: 'Campaign assets',
    role: 'owner',
  });

  const found = getJoinedSpace(spaceCode);
  assert.ok(found);
  assert.equal(found.id, spaceCode);
  assert.equal(found.name, 'Marketing Launch Desk');

  const all = listJoinedSpaces();
  assert.ok(all.some(s => s.id === spaceCode));

  removeJoinedSpace(spaceCode);
  assert.equal(getJoinedSpace(spaceCode), null);
});
