/* ============================================================
   Avatars: one resolution rule everywhere, and cloud sync
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { avatarSrcOf, getUserAvatarHtml } = await import('../../js/lib/profile-pictures.js');
const SB = await import('../../js/lib/supabase.js');

test('Avatars: a chosen picture wins, then the account photo, else none', () => {
  assert.equal(avatarSrcOf({ profilePicture: 'default', avatarUrl: 'https://lh3.googleusercontent.com/a/x' }), 'https://lh3.googleusercontent.com/a/x', "'default' must not hide a Google photo");
  assert.match(avatarSrcOf({ profilePicture: 'apple', avatarUrl: 'https://old.example/x.png' }), /apple/);
  assert.match(avatarSrcOf({ profile_picture: 'apple', avatar_url: null }), /apple/, 'profile rows (snake_case)');
  assert.equal(avatarSrcOf({ other_avatar_url: 'https://x/y.png' }), 'https://x/y.png', 'Messages rows');
  assert.equal(avatarSrcOf({ user_metadata: { picture: 'https://g/p.jpg' } }), 'https://g/p.jpg');
  assert.equal(avatarSrcOf({ profilePicture: 'default' }), null);
  assert.equal(avatarSrcOf(null), null);
  assert.match(getUserAvatarHtml({ profilePicture: 'default', avatarUrl: 'https://g/p.jpg' }, 40), /src="https:\/\/g\/p\.jpg"/);
});

test('Avatars: the cloud profile is adopted locally without losing an account photo', async () => {
  const session = { id: 'u1', email: 'a@b.c', token: 'jwt.real.token', displayName: 'A', avatarUrl: 'https://g/p.jpg', profilePicture: 'default', user_metadata: {} };
  localStorage.setItem('toolbox_supabase_session', JSON.stringify(session));
  localStorage.setItem('supabase_auth_session', JSON.stringify(session));
  SB.saveSupabaseConfig?.('https://proj.supabase.co', 'anon-key');
  const realFetch = globalThis.fetch;
  let row = { display_name: 'A', avatar_url: null, profile_picture: 'default' };
  globalThis.fetch = async () => ({ ok: true, json: async () => [row] });
  try {
    let u = await SB.syncProfileFromCloud({ force: true });
    assert.equal(u.avatarUrl, 'https://g/p.jpg', 'an empty cloud row keeps the Google photo');
    row = { display_name: 'A', avatar_url: '/profile-pictures/apple.png', profile_picture: 'apple' };
    u = await SB.syncProfileFromCloud({ force: true });
    assert.equal(u.profilePicture, 'apple');
    assert.match(avatarSrcOf(SB.getCurrentUser()), /apple/);
    row = { display_name: 'A', avatar_url: null, profile_picture: 'default' };
    u = await SB.syncProfileFromCloud({ force: true });
    assert.equal(avatarSrcOf(SB.getCurrentUser()), null, 'choosing no picture on another device clears it here');
  } finally {
    globalThis.fetch = realFetch;
  }
});
