/* ============================================================
   Mock Profile System
   Simulates a backend for user profiles (username/profile/affiliation/bio).
   Persists to localStorage.
   ============================================================ */

const PROFILE_KEY = 'toolbox_my_profile_v1';
const MOCK_PROFILES_KEY = 'toolbox_mock_profiles_v1';

const DEFAULT_MOCK_PROFILES = [
  { id: 'usr_1', username: 'alice.dev', name: 'Alice Smith', affiliation: 'Frontend Team', bio: 'Building UIs and drinking coffee.', avatar: 'AS' },
  { id: 'usr_2', username: 'bob.ops', name: 'Bob Jones', affiliation: 'DevOps', bio: 'I make sure the servers stay up.', avatar: 'BJ' },
  { id: 'usr_3', username: 'charlie.data', name: 'Charlie Davis', affiliation: 'Data Science', bio: 'Data cruncher.', avatar: 'CD' }
];

export function getMyProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const defaultProfile = {
    id: 'usr_me',
    username: 'my.user',
    name: 'My User',
    affiliation: 'My Company',
    bio: 'Hello world!',
    avatar: 'ME'
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile));
  return defaultProfile;
}

export function updateMyProfile(patch) {
  const current = getMyProfile();
  const updated = { ...current, ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

export function getPublicProfiles() {
  try {
    const raw = localStorage.getItem(MOCK_PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(DEFAULT_MOCK_PROFILES));
  return DEFAULT_MOCK_PROFILES;
}
