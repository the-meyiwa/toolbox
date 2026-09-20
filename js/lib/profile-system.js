/* ============================================================
   Profile System & People Directory
   Authoritative lookup for users across the organization.
   Enables search by display name, username (@handle), and role.
   ============================================================ */

const PROFILE_KEY = 'toolbox_my_profile_v1';
const MOCK_PROFILES_KEY = 'toolbox_mock_profiles_v1';

export const DEFAULT_MOCK_PROFILES = [
  { id: 'usr_1', username: 'alice.dev', name: 'Alice Smith', affiliation: 'Frontend Lead', bio: 'Building minimalist interfaces & drinking coffee.', avatar: 'AS' },
  { id: 'usr_2', username: 'bob.ops', name: 'Bob Jones', affiliation: 'DevOps & Cloud', bio: 'Ensuring 99.99% uptime and low latency.', avatar: 'BJ' },
  { id: 'usr_3', username: 'charlie.data', name: 'Charlie Davis', affiliation: 'Data Science', bio: 'Machine learning, statistics, and analytics.', avatar: 'CD' },
  { id: 'usr_4', username: 'diana.design', name: 'Diana Prince', affiliation: 'Product Design', bio: 'Obsessed with typography, spacing, and glass aesthetics.', avatar: 'DP' },
  { id: 'usr_5', username: 'ethan.sec', name: 'Ethan Hunt', affiliation: 'Security & Auth', bio: 'Passkeys, encryption, and zero-trust systems.', avatar: 'EH' },
  { id: 'usr_6', username: 'fiona.product', name: 'Fiona Gallagher', affiliation: 'Product Management', bio: 'Roadmaps, specs, and user delight.', avatar: 'FG' },
  { id: 'usr_7', username: 'george.backend', name: 'George Clark', affiliation: 'Backend Architecture', bio: 'Distributed systems, CRDTs, and real-time relays.', avatar: 'GC' },
  { id: 'usr_8', username: 'hannah.mobile', name: 'Hannah Abbott', affiliation: 'Mobile Engineering', bio: 'Responsive layouts, gestures, and native performance.', avatar: 'HA' },
  { id: 'usr_9', username: 'isaac.research', name: 'Isaac Newton', affiliation: 'Applied Mathematics', bio: 'Discrete math, algorithms, and numerical methods.', avatar: 'IN' },
  { id: 'usr_10', username: 'julia.legal', name: 'Julia Roberts', affiliation: 'Legal & Compliance', bio: 'Contracts, IP protection, and data governance.', avatar: 'JR' },
  { id: 'usr_11', username: 'kevin.net', name: 'Kevin Mitnick', affiliation: 'Networking', bio: 'WebRTC, DNS, and peer-to-peer topologies.', avatar: 'KM' },
  { id: 'usr_12', username: 'laura.qa', name: 'Laura Croft', affiliation: 'QA & Testing', bio: 'Automated test suites and regression prevention.', avatar: 'LC' },
  { id: 'usr_13', username: 'marcus.ops', name: 'Marcus Aurelius', affiliation: 'Infrastructure Lead', bio: 'Stoic systems administration and edge computing.', avatar: 'MA' },
  { id: 'usr_14', username: 'nina.audio', name: 'Nina Simone', affiliation: 'Sound Design', bio: 'Synthesizers, audio tagging, and acoustic cues.', avatar: 'NS' },
  { id: 'usr_15', username: 'oliver.exec', name: 'Oliver Queen', affiliation: 'Engineering Director', bio: 'Building the future of privacy-first local computing.', avatar: 'OQ' }
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
    affiliation: 'Toolbox User',
    bio: 'Local-first collaboration.',
    avatar: 'ME'
  };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile));
  } catch (e) {}
  return defaultProfile;
}

export function updateMyProfile(patch) {
  const current = getMyProfile();
  const updated = { ...current, ...patch };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function getPublicProfiles() {
  try {
    const raw = localStorage.getItem(MOCK_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= DEFAULT_MOCK_PROFILES.length) {
        return parsed;
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(DEFAULT_MOCK_PROFILES));
  } catch (e) {}
  return DEFAULT_MOCK_PROFILES;
}

export function searchPublicProfiles(query = '') {
  const q = String(query || '').toLowerCase().trim();
  const all = getPublicProfiles();
  if (!q) return all;
  const cleanQ = q.startsWith('@') ? q.slice(1) : q;
  return all.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.username.toLowerCase().includes(cleanQ) || 
    (p.affiliation && p.affiliation.toLowerCase().includes(q))
  );
}
