/* ============================================================
   TOOLBOX — Supabase Integration & Dual Storage Engine
   Manages user authentication, cloud storage synchronization,
   PostgreSQL database operations, and persistent online storage.
   ============================================================ */

import { isTestAccountEmail, isIssuedAccessToken, TEST_ACCOUNT_MESSAGE } from './account-policy.js';

const STORAGE_MODE_KEY = 'toolbox_storage_mode'; // 'local' | 'supabase'
const SUPABASE_SESSION_KEY = 'toolbox_supabase_session';
const SUPABASE_CUSTOM_URL_KEY = 'toolbox_supabase_url';
const SUPABASE_CUSTOM_KEY_KEY = 'toolbox_supabase_anon_key';
const CLAIMED_USERNAMES_KEY = 'toolbox_claimed_usernames';
const ASSISTANT_CLOUD_CONVERSATIONS_KEY = 'toolbox_cloud_assistant_conversations';

export const MADSELKIE_EMAILS = Object.freeze([
  'meyigbenee@gmail.com',
  'meyigbenee@icloud.com'
]);

/**
 * Get active Supabase configuration
 */
export function getSupabaseConfig() {
  const customUrl = (typeof localStorage !== 'undefined' && localStorage.getItem(SUPABASE_CUSTOM_URL_KEY)) || '';
  const customKey = (typeof localStorage !== 'undefined' && localStorage.getItem(SUPABASE_CUSTOM_KEY_KEY)) || '';

  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  return {
    url: customUrl || envUrl || 'https://ssoruyruzbvgyondxlgj.supabase.co',
    anonKey: customKey || envKey || 'sb_publishable_iZcbpvF209tCXSuqNm4Ckw_xOFFMM-S'
  };
}

/**
 * Save custom Supabase credentials from client UI
 */
export function saveSupabaseConfig(url, anonKey) {
  if (typeof localStorage === 'undefined') return;
  if (url) localStorage.setItem(SUPABASE_CUSTOM_URL_KEY, url.trim().replace(/\/$/, ''));
  else localStorage.removeItem(SUPABASE_CUSTOM_URL_KEY);

  if (anonKey) localStorage.setItem(SUPABASE_CUSTOM_KEY_KEY, anonKey.trim());
  else localStorage.removeItem(SUPABASE_CUSTOM_KEY_KEY);

  window.dispatchEvent(new CustomEvent('toolbox:supabaseconfigchange'));
}

/**
 * Test connectivity to configured Supabase project
 */
export async function testSupabaseConnection() {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return { connected: false, message: 'Supabase URL or Anon Key is missing.' };
  }

  try {
    const res = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { 'apikey': config.anonKey }
    });
    if (res.ok) {
      return { connected: true, message: 'Successfully connected to Supabase project!' };
    }
    const err = await res.json().catch(() => ({}));
    return { connected: false, message: err.message || `HTTP ${res.status}` };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

/**
 * Get current storage mode preference: 'local' (default) or 'supabase'
 */
export function getStorageMode() {
  try {
    return localStorage.getItem(STORAGE_MODE_KEY) || 'local';
  } catch {
    return 'local';
  }
}

/**
 * Set storage mode preference
 */
export function setStorageMode(mode) {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    window.dispatchEvent(new CustomEvent('toolbox:storagemodechange', { detail: { mode } }));
  } catch {}
}

/**
 * Get current user session
 */
/**
 * Get current user session with authoritative unique username
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.token) {
      return null;
    }

    const email = (parsed.email || '').toLowerCase().trim();
    if (MADSELKIE_EMAILS.includes(email)) {
      parsed.username = 'madselkie';
      if (!parsed.displayName) parsed.displayName = 'madselkie';
    } else if (!parsed.username) {
      parsed.username = parsed.user_metadata?.username || (email ? email.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase() : 'user');
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check if a username is available across the system
 */
export function isUsernameAvailable(username, currentEmail = null) {
  if (!username) return { available: false, error: 'Username cannot be empty.' };
  const normalized = String(username).trim().toLowerCase().replace(/^@/, '');
  
  if (normalized.length < 3) return { available: false, error: 'Username must be at least 3 characters.' };
  if (normalized.length > 24) return { available: false, error: 'Username must be 24 characters or less.' };
  if (!/^[a-z0-9_-]+$/.test(normalized)) return { available: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' };

  const email = (currentEmail || getCurrentUser()?.email || '').toLowerCase().trim();

  // 'madselkie' is strictly reserved for the owner accounts
  if (normalized === 'madselkie') {
    if (MADSELKIE_EMAILS.includes(email)) {
      return { available: true, username: 'madselkie' };
    }
    return { available: false, error: 'The username "madselkie" is reserved.' };
  }

  // Check against other claimed usernames in local registry
  try {
    const registry = JSON.parse(localStorage.getItem(CLAIMED_USERNAMES_KEY) || '{}');
    const claimedBy = registry[normalized];
    if (claimedBy && claimedBy !== email) {
      return { available: false, error: `The username "@${normalized}" is already taken.` };
    }
  } catch {}

  return { available: true, username: normalized };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Gets username change eligibility status (usernames can only be changed once a week)
 */
export function getUsernameChangeStatus(user = null) {
  const current = user || getCurrentUser();
  if (!current) return { canChange: false, reason: 'not_authenticated', message: 'Not authenticated.' };

  const email = (current.email || '').toLowerCase().trim();
  if (MADSELKIE_EMAILS.includes(email)) {
    return { canChange: false, reason: 'owner_reserved', message: 'Verified owner handle is permanent.' };
  }

  const lastChanged = current.username_changed_at || current.user_metadata?.username_changed_at;
  if (!lastChanged) {
    return { canChange: true, message: '' };
  }

  const elapsed = Date.now() - new Date(lastChanged).getTime();
  if (elapsed < SEVEN_DAYS_MS) {
    const remainingMs = SEVEN_DAYS_MS - elapsed;
    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.ceil((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const timeRemainingStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    return {
      canChange: false,
      reason: 'cooldown',
      daysRemaining: days,
      hoursRemaining: hours,
      timeRemainingStr,
      nextChangeDate: new Date(new Date(lastChanged).getTime() + SEVEN_DAYS_MS),
      message: `Usernames can only be changed once a week. Available in ${timeRemainingStr}.`
    };
  }

  return { canChange: true, message: '' };
}

/**
 * Claim or update user's unique username
 */
export function claimUsername(newUsername) {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Sign in required to claim username.' };

  const email = (current.email || '').toLowerCase().trim();
  if (MADSELKIE_EMAILS.includes(email)) {
    // Owner is permanently assigned madselkie
    return updateUserProfile({ username: 'madselkie' });
  }

  const check = isUsernameAvailable(newUsername, email);
  if (!check.available) {
    return { success: false, error: check.error };
  }

  // Check if user is keeping their current username
  if (current.username && current.username.toLowerCase() === check.username.toLowerCase()) {
    return { success: true, user: current, message: `Username is already @${check.username}` };
  }

  // Rate-limit username changes to once every 7 days (once a week)
  const status = getUsernameChangeStatus();
  if (!status.canChange && status.reason === 'cooldown') {
    return { success: false, error: status.message };
  }

  try {
    const registry = JSON.parse(localStorage.getItem(CLAIMED_USERNAMES_KEY) || '{}');
    // Remove old handle if changing
    if (current.username && current.username !== check.username) {
      delete registry[current.username.toLowerCase()];
    }
    registry[check.username] = email;
    localStorage.setItem(CLAIMED_USERNAMES_KEY, JSON.stringify(registry));
  } catch {}

  const nowIso = new Date().toISOString();
  const updated = updateUserProfile({ username: check.username, username_changed_at: nowIso });
  return { success: true, user: updated };
}

/**
 * Updates user profile metadata (username, displayName, profilePicture, avatarUrl, username_changed_at)
 */
export function updateUserProfile({ username, displayName, avatarUrl, profilePicture, username_changed_at } = {}, { remote = true } = {}) {
  const current = getCurrentUser();
  if (!current) return null;

  const email = (current.email || '').toLowerCase().trim();
  let finalUsername = current.username;
  if (MADSELKIE_EMAILS.includes(email)) {
    finalUsername = 'madselkie';
  } else if (username !== undefined) {
    finalUsername = String(username).trim().toLowerCase().replace(/^@/, '');
  }

  const finalChangedAt = username_changed_at !== undefined
    ? username_changed_at
    : (current.username_changed_at || current.user_metadata?.username_changed_at || null);

  const user_metadata = {
    ...(current.user_metadata || {}),
    username: finalUsername,
    ...(finalChangedAt ? { username_changed_at: finalChangedAt } : {}),
    ...(displayName !== undefined ? { display_name: displayName, name: displayName } : {}),
    ...(avatarUrl !== undefined ? { avatar_url: avatarUrl, picture: avatarUrl } : {}),
    ...(profilePicture !== undefined ? { profile_picture: profilePicture } : {})
  };

  const updated = {
    ...current,
    username: finalUsername,
    username_changed_at: finalChangedAt,
    displayName: displayName !== undefined ? displayName : (current.displayName || user_metadata.display_name),
    avatarUrl: avatarUrl !== undefined ? avatarUrl : (current.avatarUrl || user_metadata.avatar_url),
    profilePicture: profilePicture !== undefined ? profilePicture : (current.profilePicture || user_metadata.profile_picture || 'default'),
    user_metadata
  };

  try {
    localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: updated } }));
  } catch {}

  // Keep the public Toolbox identity coherent across Messages and Mail.
  // This is intentionally fire-and-forget so profile editing still works offline.
  try {
    const config = getSupabaseConfig();
    if (remote && current.id && current.token && !current.token.startsWith('tok_')) {
      fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(current.id)}`, {
        method: 'PATCH',
        headers: { apikey: config.anonKey, Authorization: `Bearer ${current.token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        // Only the fields that actually changed. Sending the username on every
        // save made unrelated edits (an avatar) collide with profiles_username_unique.
        body: JSON.stringify(profileColumns({ username, displayName, avatarUrl, profilePicture }))
      }).catch(() => {});
    }
  } catch {}

  return updated;
}

/**
 * Pulls the signed-in user's saved profile (name and picture) from the cloud
 * and adopts it locally, so a picture changed on another device shows up
 * here too. Throttled; safe to call often. Returns the (possibly) updated user.
 */
let lastProfileSync = 0;
export async function syncProfileFromCloud({ force = false } = {}) {
  const u = getCurrentUser();
  if (!u?.id || !u.token || String(u.token).startsWith('tok_')) return null;
  if (!force && Date.now() - lastProfileSync < 30000) return u;
  lastProfileSync = Date.now();
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return u;
  try {
    const res = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=display_name,avatar_url,profile_picture`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${u.token}` },
    });
    if (!res.ok) return u;
    const [row] = await res.json();
    if (!row) return u;
    const localPreset = u.profilePicture || u.user_metadata?.profile_picture || 'default';
    const localUrl = u.avatarUrl || u.user_metadata?.avatar_url || '';
    const patch = {};
    const cloudPreset = row.profile_picture || 'default';
    if (cloudPreset !== localPreset && (cloudPreset !== 'default' || row.avatar_url || localPreset !== 'default')) patch.profilePicture = cloudPreset;
    // A cloud row with no picture at all must not wipe an account photo (Google) kept locally.
    if (row.avatar_url && row.avatar_url !== localUrl) patch.avatarUrl = row.avatar_url;
    else if (!row.avatar_url && cloudPreset === 'default' && localPreset !== 'default') patch.avatarUrl = '';
    if (row.display_name && row.display_name !== u.displayName) patch.displayName = row.display_name;
    return Object.keys(patch).length ? updateUserProfile(patch, { remote: false }) : u;
  } catch {
    return u;
  }
}

/** Map profile fields that were supplied to their database columns (undefined = unchanged). */
function profileColumns({ username, displayName, avatarUrl, profilePicture } = {}) {
  const out = { updated_at: new Date().toISOString() };
  if (username !== undefined) out.username = username ? String(username).trim().toLowerCase().replace(/^@/, '') : null;
  if (displayName !== undefined) out.display_name = displayName || null;
  if (avatarUrl !== undefined) out.avatar_url = avatarUrl || null;
  if (profilePicture !== undefined) out.profile_picture = profilePicture || 'default';
  return out;
}

const isUsernameClash = (body) => body?.code === '23505' && /username/i.test(`${body?.message || ''} ${body?.details || ''}`);

/**
 * Save profile changes to Supabase.
 * Updates only the columns in `patch`, so changing an avatar never touches the
 * username. If the row does not exist yet it is created; a username that another
 * account already holds is left out rather than failing the whole save.
 */
export async function persistUserProfile(patch = {}) {
  const current = getCurrentUser();
  if (!current) throw new Error('Sign in to save your profile.');
  const updated = updateUserProfile(patch, { remote: false });
  if (!current.id || !current.token || current.token.startsWith('tok_')) return updated;
  const config = getSupabaseConfig();
  const headers = { apikey: config.anonKey, Authorization: `Bearer ${current.token}`, 'Content-Type': 'application/json' };
  const cols = profileColumns(patch);

  // 1. update the existing row
  const res = await fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(current.id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(cols),
  });
  const body = await res.json().catch(() => null);
  if (res.ok && Array.isArray(body) && body.length) return updated;
  if (!res.ok) {
    if (isUsernameClash(body)) throw new Error(`The username "@${cols.username}" is already taken. Choose another one.`);
    throw new Error(body?.message || 'Your profile could not be saved.');
  }

  // 2. no row yet: create it
  const insert = async (row) => fetch(`${config.url}/rest/v1/profiles`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(row),
  });
  const row = {
    id: current.id, email: current.email || null, messaging_enabled: true,
    username: updated.username || null, display_name: updated.displayName || null,
    avatar_url: updated.avatarUrl || null, profile_picture: updated.profilePicture || 'default', ...cols,
  };
  let created = await insert(row);
  if (!created.ok) {
    const err = await created.json().catch(() => ({}));
    if (!isUsernameClash(err)) throw new Error(err.message || 'Your profile could not be saved.');
    if (patch.username !== undefined) throw new Error(`The username "@${row.username}" is already taken. Choose another one.`);
    created = await insert({ ...row, username: null });   // keep the avatar; the username can be claimed later
    if (!created.ok) {
      const again = await created.json().catch(() => ({}));
      throw new Error(again.message || 'Your profile could not be saved.');
    }
  }
  return updated;
}

/**
 * Initiate OAuth sign-in with Google or GitHub
 * @param {'google'|'github'} provider
 */
export function signInWithOAuth(provider) {
  const config = getSupabaseConfig();
  const cleanProvider = String(provider || '').trim().toLowerCase();
  if (!cleanProvider || !['google', 'github'].includes(cleanProvider)) {
    throw new Error('Unsupported authentication provider.');
  }

  if (!config.url || !config.anonKey) {
    throw new Error('Supabase project is not configured.');
  }

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
  const authorizeUrl = `${config.url}/auth/v1/authorize?provider=${encodeURIComponent(cleanProvider)}&redirect_to=${encodeURIComponent(redirectTo)}`;

  if (typeof window !== 'undefined') {
    window.location.href = authorizeUrl;
  }
  return authorizeUrl;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const config = getSupabaseConfig();
  if (isTestAccountEmail(cleanEmail)) return { success: false, error: TEST_ACCOUNT_MESSAGE };
  try {
    if (config.url && config.anonKey) {
      const res = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey
        },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error_description || data.message || data.msg || (data.error === 'invalid_grant' ? 'Invalid email or password.' : 'Login failed');
        throw new Error(errorMsg);
      }
      if (!data.access_token || !data.user?.id || !data.user?.email) {
        throw new Error('The sign-in response was incomplete. Please try again.');
      }

      const verifiedEmail = String(data.user.email).toLowerCase().trim();
      if (isTestAccountEmail(verifiedEmail)) throw new Error(TEST_ACCOUNT_MESSAGE);
      const isOwner = MADSELKIE_EMAILS.includes(verifiedEmail);
      const userSession = {
        id: data.user.id,
        email: verifiedEmail,
        token: data.access_token,
        refreshToken: data.refresh_token,
        username: isOwner ? 'madselkie' : (data.user?.user_metadata?.username || cleanEmail.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase()),
        displayName: isOwner ? 'madselkie' : (data.user?.user_metadata?.display_name || cleanEmail.split('@')[0]),
        createdAt: data.user?.created_at || new Date().toISOString()
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
      localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
      rememberForPasskey(userSession);
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
      queueMicrotask(() => updateUserProfile({ username: userSession.username, displayName: userSession.displayName }));
      return { success: true, user: userSession };
    }

    // There are no local or simulated accounts: every account is a real one from the auth provider.
    throw new Error('Accounts are not available right now. Please try again later.');
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Refresh current user session using refresh token
 */
let refreshInFlight = null;
export function refreshUserSession() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshUserSessionOnce().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function refreshUserSessionOnce() {
  const config = getSupabaseConfig();
  const current = getCurrentUser();
  if (!current || !current.refreshToken || !config.url || !config.anonKey) {
    return current;
  }

  try {
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey
      },
      body: JSON.stringify({ refresh_token: current.refreshToken })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const latest = getCurrentUser();
        if (!latest || latest.id !== current.id || latest.refreshToken !== current.refreshToken) return latest;
        signOut();
        return null;
      }
      return current;
    }

    const data = await res.json();
    if (data.access_token) {
      const latest = getCurrentUser();
      if (!latest || latest.id !== current.id || latest.refreshToken !== current.refreshToken) return latest;
      const updated = {
        ...current,
        token: data.access_token,
        refreshToken: data.refresh_token || current.refreshToken,
        id: data.user?.id || current.id,
        email: data.user?.email || current.email
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(updated));
      rememberForPasskey(updated);
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: updated } }));
      return updated;
    }
  } catch (e) {
    console.warn('Failed to refresh user session:', e);
  }
  return current;
}

/**
 * Validate current user session against Supabase
 * If account was deleted or token revoked, signs out cleanly.
 */
export async function validateSession() {
  const current = getCurrentUser();
  if (!current) return null;
  // Sessions the auth provider never issued (old simulated or test accounts) are not kept.
  if (!isIssuedAccessToken(current.token) || isTestAccountEmail(current.email)) {
    signOut();
    return null;
  }
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return current;
  try {
    const res = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${current.token}`
      }
    });
    if (res.ok) {
      const who = await res.json().catch(() => null);
      const email = String(who?.email || '').toLowerCase().trim();
      if (!who?.id || isTestAccountEmail(email)) { signOut(); return null; }
      // The provider's identity wins over whatever was stored in the browser.
      const latest = getCurrentUser();
      if (latest && latest.token === current.token && (latest.id !== who.id || (latest.email || '').toLowerCase() !== email)) {
        const isOwner = MADSELKIE_EMAILS.includes(email);
        const fixed = { ...latest, id: String(who.id), email, ...(isOwner ? { username: 'madselkie', displayName: 'madselkie' } : {}) };
        localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(fixed));
        window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: fixed } }));
        return fixed;
      }
      return latest || current;
    }
    if (res.status === 401 || res.status === 403) {
      if (current.refreshToken) {
        const refreshed = await refreshUserSession();
        if (refreshed && refreshed.token !== current.token) return refreshed;
      }
      signOut();
      return null;
    }
  } catch {
    // Offline or the provider is unreachable: keep the session until it can be checked.
  }
  return current;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const config = getSupabaseConfig();
  if (isTestAccountEmail(cleanEmail)) return { success: false, error: TEST_ACCOUNT_MESSAGE };
  try {
    if (config.url && config.anonKey) {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const res = await fetch(`${config.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          ...(redirectUrl ? { redirect_to: redirectUrl } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error_description || data.message || data.msg || 'Sign up failed';
        throw new Error(errorMsg);
      }

      // If Supabase returned an access_token directly (instant confirmation or email confirmation disabled)
      if (data.access_token) {
        if (!data.user?.id || !data.user?.email) {
          throw new Error('The sign-up response was incomplete. Please try again.');
        }
        const verifiedEmail = String(data.user.email).toLowerCase().trim();
        if (isTestAccountEmail(verifiedEmail)) throw new Error(TEST_ACCOUNT_MESSAGE);
        const isOwner = MADSELKIE_EMAILS.includes(verifiedEmail);
        const userSession = {
          id: data.user.id,
          email: verifiedEmail,
          token: data.access_token,
          refreshToken: data.refresh_token || '',
          username: isOwner ? 'madselkie' : (data.user?.user_metadata?.username || verifiedEmail.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase()),
          displayName: isOwner ? 'madselkie' : (data.user?.user_metadata?.display_name || verifiedEmail.split('@')[0]),
          createdAt: data.user?.created_at || new Date().toISOString()
        };
        localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
        localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
        window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
        queueMicrotask(() => updateUserProfile({ username: userSession.username, displayName: userSession.displayName }));
        return { success: true, user: userSession };
      }

      // Otherwise, the auth provider requires email confirmation
      return { success: true, requiresConfirmation: true };
    }

    throw new Error('Accounts are not available right now. Please try again later.');
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sign out
 */
export function signOut() {
  try {
    localStorage.removeItem(SUPABASE_SESSION_KEY);
    localStorage.removeItem('supabase_auth_session');
    localStorage.removeItem('sb-ssoruyruzbvgyondxlgj-auth-token');
    // Clear legacy un-scoped assistant history so previous user messages don't leak
    localStorage.removeItem('toolbox_assistant_history_v2');
    localStorage.removeItem('toolbox_assistant_history_guest');
    // Reset storage strategy to Browser/Local when signed out
    localStorage.setItem(STORAGE_MODE_KEY, 'local');
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: null } }));
    window.dispatchEvent(new CustomEvent('toolbox:storagemodechange', { detail: { mode: 'local' } }));
  } catch {}
}

/**
 * Subscribe to authentication state changes (sign-in, sign-out, session
 * refresh). Fires immediately with the current user, then again on every
 * 'toolbox:authchange' event, so authenticated-only UI can react (e.g. hide
 * or unmount itself) as soon as the session actually changes, instead of
 * only re-checking on next navigation/render. Returns an unsubscribe function.
 */
export function onAuthChange(callback) {
  if (typeof callback !== 'function' || typeof window === 'undefined') return () => {};
  const handler = () => {
    try { callback(getCurrentUser()); } catch {}
  };
  window.addEventListener('toolbox:authchange', handler);
  handler();
  return () => window.removeEventListener('toolbox:authchange', handler);
}

/**
 * Upload file to Supabase Storage Bucket
 */
export async function uploadToSupabaseStorage(bucketName, filePath, fileBlob) {
  const config = getSupabaseConfig();
  const user = getCurrentUser();
  if (!user) throw new Error('You must be signed in to upload files to Supabase cloud storage.');

  // Enforce user isolation: prefix user.id so RLS prevents cross-user access
  const safePath = filePath.startsWith(`${user.id}/`) ? filePath : `${user.id}/${filePath.replace(/^\/+/, '')}`;
  if (!/^[a-z0-9_-]+$/i.test(bucketName) || safePath.split('/').some(part => !part || part === '.' || part === '..' || /[\\\u0000-\u001f]/.test(part))) throw new Error('Invalid storage path.');
  const encodedPath = safePath.split('/').map(encodeURIComponent).join('/');

  if (config.url && config.anonKey) {
    const res = await fetch(`${config.url}/storage/v1/object/${bucketName}/${encodedPath}`, {
      method: 'POST',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`
      },
      body: fileBlob
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Cloud storage upload failed.');
    }
    if (getCurrentUser()?.id !== user.id) throw new Error('The account changed during upload.');
    return { path: safePath, url: `${config.url}/storage/v1/object/authenticated/${bucketName}/${encodedPath}` };
  }

  throw new Error('Cloud storage is not configured.');
}

/** Generate a short-lived download URL at use time; never store it as file metadata. */
export async function resolveStorageDownloadUrl(value) {
  const config = getSupabaseConfig();
  let target, base;
  try { target = new URL(value); base = new URL(config.url); } catch { return value; }
  if (target.origin !== base.origin || !target.pathname.startsWith('/storage/v1/object/')) return value;
  const match = target.pathname.match(/^\/storage\/v1\/object\/(?:public|authenticated|sign)\/([a-z0-9_-]+)\/(.+)$/i);
  if (!match || target.username || target.password) throw new Error('Invalid cloud file address.');
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to open this cloud file.');
  const parts = match[2].split('/').map(part => decodeURIComponent(part));
  if (parts.some(part => !part || part === '.' || part === '..' || /[\\/\u0000-\u001f]/.test(part))) throw new Error('Invalid cloud file path.');
  const response = await fetch(`${base.origin}/storage/v1/object/sign/${match[1]}/${parts.map(encodeURIComponent).join('/')}`, {
    method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }), redirect: 'error'
  });
  if (!response.ok) throw new Error('You do not have access to this cloud file.');
  const payload = await response.json();
  if (getCurrentUser()?.id !== user.id) throw new Error('The account changed while opening this file.');
  const signed = new URL(payload.signedURL || payload.signedUrl || '', `${base.origin}/storage/v1/`);
  if (signed.origin !== base.origin || !signed.pathname.startsWith('/storage/v1/object/sign/') || !signed.searchParams.has('token')) throw new Error('Cloud storage returned an invalid download address.');
  return signed.href;
}

/**
 * Delete file from Supabase Storage Bucket
 */
export async function deleteFromSupabaseStorage(bucketName, filePath) {
  const config = getSupabaseConfig();
  const user = getCurrentUser();
  if (!user) return false;

  const safePath = filePath.startsWith(`${user.id}/`) ? filePath : `${user.id}/${filePath.replace(/^\/+/, '')}`;

  if (config.url && config.anonKey) {
    try {
      const res = await fetch(`${config.url}/storage/v1/object/${bucketName}`, {
        method: 'DELETE',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [safePath] })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Sync saved artifact to Supabase PostgreSQL table
 */
export async function syncArtifactToSupabase(artifact) {
  const config = getSupabaseConfig();
  const user = getCurrentUser();
  if (!user || !config.url || !config.anonKey) return;

  try {
    await fetch(`${config.url}/rest/v1/saved_artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: artifact.id,
        user_id: user.id,
        name: artifact.name,
        kind: artifact.kind,
        from_tool: artifact.from || null,
        payload: artifact,
        updated_at: new Date().toISOString()
      })
    });
  } catch {}
}

/**
 * List saved artifacts from Supabase
 */
export async function listSupabaseArtifacts() {
  const config = getSupabaseConfig();
  const user = getCurrentUser();
  if (!user || !config.url || !config.anonKey) return [];

  try {
    const res = await fetch(`${config.url}/rest/v1/saved_artifacts?user_id=eq.${user.id}&order=updated_at.desc`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(d => d.payload || d);
  } catch {
    return [];
  }
}

/**
 * Save user settings to Supabase
 */
export async function syncSettingsToSupabase(settings) {
  const config = getSupabaseConfig();
  const user = getCurrentUser();
  if (!user || !config.url || !config.anonKey) return;

  try {
    await fetch(`${config.url}/rest/v1/user_settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: user.id,
        settings: settings,
        updated_at: new Date().toISOString()
      })
    });
  } catch {}
}

/**
 * Load user settings from Supabase
 */
export async function loadSettingsFromSupabase() {
  const config = getSupabaseConfig();
  const user = getCurrentUser();
  if (!user || !config.url || !config.anonKey) return null;

  try {
    const res = await fetch(`${config.url}/rest/v1/user_settings?user_id=eq.${user.id}`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) return data[0].settings;
    return null;
  } catch {
    return null;
  }
}

/**
 * P2P Signaling: Send WebRTC signal via Server Relay or Supabase REST
 */
export async function sendP2PSignal(roomCode, senderId, messageType, payload) {
  // First attempt local /api/filedrop relay for instant anonymous signaling
  try {
    const localRes = await fetch('/api/filedrop/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, senderId, messageType, payload })
    });
    if (localRes.ok) {
      const data = await localRes.json();
      if (data && data.success) return true;
    }
  } catch {}

  // Fallback to Supabase if configured
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return false;
  try {
    await fetch(`${config.url}/rest/v1/p2p_signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey
      },
      body: JSON.stringify({
        room_code: roomCode,
        sender_id: senderId,
        message_type: messageType,
        payload
      })
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * P2P Signaling: Poll WebRTC signals via Server Relay or Supabase REST
 */
export async function pollP2PSignals(roomCode, sinceDate) {
  // First attempt local /api/filedrop relay
  try {
    const localRes = await fetch(`/api/filedrop/poll?room=${encodeURIComponent(roomCode)}&since=${encodeURIComponent(sinceDate || '')}`);
    if (localRes.ok) {
      const data = await localRes.json();
      if (Array.isArray(data.signals) && data.signals.length > 0) {
        return data.signals;
      }
    }
  } catch {}

  // Fallback to Supabase if configured
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return [];
  try {
    const res = await fetch(`${config.url}/rest/v1/p2p_signals?room_code=eq.${roomCode}&created_at=gt.${sinceDate}&order=created_at.asc`, {
      headers: { 'apikey': config.anonKey }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Persist Assistant conversation history to Supabase cloud table
 */
// Set when the assistant_conversations table does not exist, so the app stops asking for it.
let assistantCloudMissing = false;
const isRealUserId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

export async function saveAssistantConversationToCloud(conversation) {
  const user = getCurrentUser();
  if (!user || !user.email) return false;

  const key = `${ASSISTANT_CLOUD_CONVERSATIONS_KEY}_${user.email}`;
  try {
    localStorage.setItem(key, JSON.stringify(conversation));
  } catch {}

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return true;

  if (assistantCloudMissing || !isRealUserId(user.id) || !user.token) return false;
  try {
    const res = await fetch(`${config.url}/rest/v1/assistant_conversations?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        user_id: user.id,
        user_email: user.email,
        username: user.username || 'user',
        conversation_data: conversation,
          updated_at: new Date().toISOString()
        }).replace(/\u0000/g, '')
    });
    if (res.status === 404) { assistantCloudMissing = true; return false; }   // table not created yet (supabase/assistant_conversations.sql)
    return res.ok;
  } catch (err) {
    console.warn('[Supabase] Failed to sync assistant conversation to cloud:', err);
    return false;
  }
}

/**
 * Fetch cloud-stored Assistant conversations for logged in user
 */
export async function fetchAssistantConversationsFromCloud() {
  const user = getCurrentUser();
  if (!user || !user.email) return null;

  const key = `${ASSISTANT_CLOUD_CONVERSATIONS_KEY}_${user.email}`;
  let localData = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) localData = JSON.parse(raw);
  } catch {}

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return localData;

  if (assistantCloudMissing || !isRealUserId(user.id) || !user.token) return localData;
  try {
    const res = await fetch(`${config.url}/rest/v1/assistant_conversations?user_id=eq.${encodeURIComponent(user.id)}&select=conversation_data&limit=1`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token}`
      }
    });
    if (res.status === 404) assistantCloudMissing = true;
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows[0]?.conversation_data) {
        localStorage.setItem(key, JSON.stringify(rows[0].conversation_data));
        return rows[0].conversation_data;
      }
    }
  } catch (err) {
    console.warn('[Supabase] Failed to fetch cloud conversation:', err);
  }

  return localData;
}

/**
 * Send a password reset email via Supabase Auth
 */
export async function resetPassword(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return { success: false, error: 'Please enter your email address.' };

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return { success: false, error: 'Supabase is not configured. Password reset is unavailable.' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/#type=recovery` : undefined;
    const endpoint = redirectUrl
      ? `${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectUrl)}`
      : `${config.url}/auth/v1/recover`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey
      },
      body: JSON.stringify({ email: cleanEmail })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error_description || data.message || data.msg || 'Password reset request failed.');
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch user profile from Supabase using an access token
 */
export async function getUserFromToken(token) {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !token) return null;
  try {
    const res = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update user password via Supabase Auth
 */
export async function updateUserPassword(newPassword, customToken = null) {
  const cleanPassword = (newPassword || '').trim();
  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const config = getSupabaseConfig();
  const activeUser = getCurrentUser();
  const token = customToken || activeUser?.token;

  if (config.url && config.anonKey) {
    if (!token) {
      return { success: false, error: 'Authentication token missing. Please request a new reset link.' };
    }

    try {
      const res = await fetch(`${config.url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: cleanPassword })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error_description || data.message || data.msg || 'Failed to update password.');
      }

      const isOwner = MADSELKIE_EMAILS.includes((data.email || activeUser?.email || '').toLowerCase());
      const updatedUser = {
        id: data.id || activeUser?.id || `usr_${Date.now()}`,
        email: data.email || activeUser?.email,
        token: data.access_token || token,
        refreshToken: data.refresh_token || activeUser?.refreshToken,
        username: isOwner ? 'madselkie' : (data.user_metadata?.username || activeUser?.username || (data.email || '').split('@')[0]),
        displayName: isOwner ? 'madselkie' : (data.user_metadata?.display_name || activeUser?.displayName || (data.email || '').split('@')[0]),
        createdAt: data.created_at || new Date().toISOString()
      };

      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(updatedUser));
      localStorage.setItem('supabase_auth_session', JSON.stringify(updatedUser));
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: updatedUser } }));

      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Accounts are not available right now. Please try again later.' };
}

/**
 * Parse recovery / auth redirect parameters from window.location
 */
export function parseAuthRedirect() {
  if (typeof window === 'undefined') return null;

  const rawHash = (window.location.hash || '').replace(/^#+/, '').replace(/#/g, '&');
  const rawSearch = (window.location.search || '').replace(/^\?+/, '').replace(/\?/g, '&');

  const parseParams = (str) => {
    const params = {};
    if (!str) return params;
    const parts = str.split('&');
    for (const part of parts) {
      if (!part) continue;
      const [k, ...v] = part.split('=');
      if (k) {
        try {
          const cleanKey = decodeURIComponent(k.replace(/\+/g, ' '));
          const cleanVal = decodeURIComponent(v.join('=').replace(/\+/g, ' '));
          params[cleanKey] = cleanVal;
        } catch {
          params[k] = v.join('=');
        }
      }
    }
    return params;
  };

  const hashParams = parseParams(rawHash);
  const searchParams = parseParams(rawSearch);
  const merged = { ...searchParams, ...hashParams };

  if (merged.error || merged.error_description) {
    return {
      type: 'error',
      error: merged.error_description || merged.error || 'Authentication error during redirect.'
    };
  }

  // Supabase access token redirect (recovery, signup confirmation, email change, magiclink)
  if (merged.access_token) {
    let email = null;
    let userId = null;
    let userMetadata = {};
    try {
      const parts = merged.access_token.split('.');
      if (parts[1]) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = (typeof atob === 'function')
          ? decodeURIComponent(escape(atob(base64)))
          : Buffer.from(base64, 'base64').toString('utf8');
        const payload = JSON.parse(jsonStr);
        email = payload.email || payload.user_metadata?.email || null;
        userId = payload.sub || payload.id || null;
        userMetadata = payload.user_metadata || {};
      }
    } catch {}

    const isRecovery = merged.type === 'recovery' || rawHash.includes('type=recovery') || rawSearch.includes('type=recovery');
    const isSignup = merged.type === 'signup' || rawHash.includes('type=signup') || rawSearch.includes('type=signup');
    const isEmailChange = merged.type === 'email_change' || rawHash.includes('type=email_change') || rawSearch.includes('type=email_change');
    const isInvite = merged.type === 'invite' || rawHash.includes('type=invite') || rawSearch.includes('type=invite');
    const isMagicLink = merged.type === 'magiclink' || rawHash.includes('type=magiclink') || rawSearch.includes('type=magiclink');

    let redirectType = 'token';
    if (isRecovery) redirectType = 'recovery';
    else if (isSignup) redirectType = 'signup';
    else if (isEmailChange) redirectType = 'email_change';
    else if (isInvite) redirectType = 'invite';
    else if (isMagicLink) redirectType = 'magiclink';

    return {
      type: redirectType,
      accessToken: merged.access_token,
      refreshToken: merged.refresh_token || '',
      expiresIn: merged.expires_in,
      tokenType: merged.token_type,
      email,
      userId,
      userMetadata: userMetadata || {}
    };
  }

  // PKCE code flow redirect
  if (merged.code) {
    return {
      type: 'code',
      code: merged.code
    };
  }

  return null;
}

/**
 * Resend email confirmation link via Supabase Auth
 */
export async function resendConfirmationEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return { success: false, error: 'Please enter an email address.' };

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return { success: false, error: 'Supabase configuration is missing.' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const res = await fetch(`${config.url}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey
      },
      body: JSON.stringify({
        type: 'signup',
        email: cleanEmail,
        ...(redirectUrl ? { redirect_to: redirectUrl } : {})
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.message || data.msg || 'Failed to resend confirmation email.');
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* ============================================================
   PASSKEYS & WEBAUTHN BIOMETRICS ENGINE
   ============================================================ */

const PASSKEYS_STORAGE_KEY = 'toolbox_passkeys';
// A passkey on this device unlocks the account's real session: the latest refresh token from
// the auth provider is kept for each account with a passkey here, and exchanged on unlock.
// Nothing is ever invented locally: no token from the provider, no session.
const PASSKEY_UNLOCK_KEY = 'toolbox_passkey_unlock';
function readUnlocks() {
  try { const v = JSON.parse(localStorage.getItem(PASSKEY_UNLOCK_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
function writeUnlock(userId, refreshToken) {
  if (typeof localStorage === 'undefined' || !userId) return;
  const all = readUnlocks();
  if (refreshToken) all[userId] = refreshToken; else delete all[userId];
  try { localStorage.setItem(PASSKEY_UNLOCK_KEY, JSON.stringify(all)); } catch { /* storage full or blocked */ }
}
/** Keeps a passkey's unlock in step when the account signs in again or its session refreshes. */
function rememberForPasskey(session) {
  if (session?.id && session.refreshToken && Object.prototype.hasOwnProperty.call(readUnlocks(), session.id)) writeUnlock(session.id, session.refreshToken);
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = (typeof btoa === 'function')
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64Url) {
  let str = (base64Url || '').replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  if (typeof atob === 'function') {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  return Buffer.from(str, 'base64').buffer;
}

/**
 * Check if WebAuthn / Passkeys are supported in the current environment
 */
export function isPasskeySupported() {
  return typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof navigator !== 'undefined' &&
    navigator.credentials !== undefined &&
    typeof navigator.credentials.create === 'function';
}

export function hasPasskeySupport() {
  return isPasskeySupported();
}

/**
 * Get registered passkeys for a user or local device
 */
export function getRegisteredPasskeys(user = null) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PASSKEYS_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(all)) return [];
    if (!user) return all;
    return all.filter(pk => pk.userEmail === user.email || pk.userId === user.id);
  } catch {
    return [];
  }
}

/**
 * Register a new WebAuthn passkey for the current signed-in user
 */
export async function registerPasskey(user = null, deviceName = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser) {
    return { success: false, error: 'You must be signed in to register a passkey.' };
  }
  if (!isIssuedAccessToken(activeUser.token) || !activeUser.refreshToken || isTestAccountEmail(activeUser.email)) {
    return { success: false, error: 'Sign in with your password first, then add a passkey.' };
  }
  if (!isPasskeySupported()) {
    return { success: false, error: 'Passkeys and WebAuthn are not supported on this device or browser.' };
  }

  try {
    const cr = (typeof crypto !== 'undefined' ? crypto : (globalThis.crypto || null));
    const challenge = cr ? cr.getRandomValues(new Uint8Array(32)) : new Uint8Array(32);
    const userIdBuffer = new TextEncoder().encode(activeUser.id || activeUser.email || 'user');
    const rpId = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost';

    const publicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Toolbox',
        id: rpId
      },
      user: {
        id: userIdBuffer,
        name: activeUser.email || 'user@toolbox.app',
        displayName: (activeUser.displayName || activeUser.email || 'Toolbox User').split('@')[0]
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    if (!credential) {
      throw new Error('Credential creation was cancelled or timed out.');
    }

    const credentialId = credential.id || bufferToBase64Url(credential.rawId);
    let resolvedName = (deviceName || '').trim();
    if (!resolvedName) {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      if (ua.includes('Macintosh') || ua.includes('Mac OS')) resolvedName = 'MacBook Touch ID';
      else if (ua.includes('iPhone') || ua.includes('iPad')) resolvedName = 'Apple Biometrics';
      else if (ua.includes('Android')) resolvedName = 'Android Biometrics';
      else if (ua.includes('Windows')) resolvedName = 'Windows Hello';
      else resolvedName = 'Security Authenticator';
    }

    const passkeyRecord = {
      id: credentialId,
      name: resolvedName,
      userEmail: activeUser.email,
      userId: activeUser.id,
      createdAt: new Date().toISOString(),
      transports: credential.response?.getTransports?.() || ['internal']
    };

    // Save locally
    const existing = getRegisteredPasskeys();
    const updated = existing.filter(k => k.id !== credentialId).concat([passkeyRecord]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PASSKEYS_STORAGE_KEY, JSON.stringify(updated));
    }
    writeUnlock(activeUser.id, activeUser.refreshToken);

    // Synchronize to Supabase user_metadata if cloud session exists
    const config = getSupabaseConfig();
    if (config.url && config.anonKey && activeUser.token) {
      try {
        await fetch(`${config.url}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.anonKey,
            'Authorization': `Bearer ${activeUser.token}`
          },
          body: JSON.stringify({
            data: {
              passkeys: updated.filter(k => k.userEmail === activeUser.email || k.userId === activeUser.id)
            }
          })
        });
      } catch {}
    }

    return { success: true, passkey: passkeyRecord };
  } catch (err) {
    const errorMsg = err.name === 'NotAllowedError'
      ? 'Passkey registration was cancelled or biometric verification timed out.'
      : (err.message || 'Failed to register passkey.');
    return { success: false, error: errorMsg };
  }
}

/**
 * Verify user password against Supabase Auth (or dev account fallback)
 */
export async function verifyUserPassword(password, user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser || !activeUser.email) {
    return { success: false, error: 'User is not authenticated.' };
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  const config = getSupabaseConfig();
  if (config.url && config.anonKey && isIssuedAccessToken(activeUser.token)) {
    try {
      const res = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey
        },
        body: JSON.stringify({ email: activeUser.email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error_description || (data.error === 'invalid_grant' ? 'Incorrect password.' : 'Password verification failed.');
        return { success: false, error: errorMsg };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Verification failed.' };
    }
  }

  // No simulated checks: without a real session there is nothing to verify against.
  return { success: false, error: 'Sign in again to confirm your password.' };
}

/**
 * Remove a registered passkey, requiring account password verification for security
 */
export async function removeRegisteredPasskey(user = null, passkeyId, password = null) {
  const activeUser = user || getCurrentUser();
  if (!passkeyId) return { success: false, error: 'Passkey identifier is required.' };

  if (password !== null && password !== undefined) {
    const verified = await verifyUserPassword(password, activeUser);
    if (!verified.success) {
      return { success: false, error: verified.error || 'Incorrect password.' };
    }
  }

  const existing = getRegisteredPasskeys();
  const removed = existing.find(k => k.id === passkeyId);
  const updated = existing.filter(k => k.id !== passkeyId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PASSKEYS_STORAGE_KEY, JSON.stringify(updated));
  }
  if (removed?.userId && !updated.some(k => k.userId === removed.userId)) writeUnlock(removed.userId, null);

  const config = getSupabaseConfig();
  if (activeUser && config.url && config.anonKey && activeUser.token) {
    try {
      await fetch(`${config.url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey,
          'Authorization': `Bearer ${activeUser.token}`
        },
        body: JSON.stringify({
          data: {
            passkeys: updated.filter(k => k.userEmail === activeUser.email || k.userId === activeUser.id)
          }
        })
      });
    } catch {}
  }

  return { success: true };
}

/**
 * Authenticate using a WebAuthn passkey
 */
export async function authenticateWithPasskey(emailHint = null) {
  if (!isPasskeySupported()) {
    return { success: false, error: 'Passkeys and WebAuthn are not supported on this browser.' };
  }

  try {
    const cr = (typeof crypto !== 'undefined' ? crypto : (globalThis.crypto || null));
    const challenge = cr ? cr.getRandomValues(new Uint8Array(32)) : new Uint8Array(32);
    const rpId = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost';

    const registered = getRegisteredPasskeys();
    const cleanHint = (emailHint || '').trim().toLowerCase();
    const candidateKeys = cleanHint
      ? registered.filter(k => k.userEmail === cleanHint)
      : registered;
    if (!candidateKeys.length) {
      return { success: false, error: 'There is no passkey for that account on this device. Sign in with your password.' };
    }

    const allowCredentials = candidateKeys.map(k => ({
      id: base64UrlToBuffer(k.id),
      type: 'public-key',
      transports: k.transports || ['internal']
    }));

    const getOptions = {
      challenge,
      rpId,
      userVerification: 'required',
      timeout: 60000,
      ...(allowCredentials.length > 0 ? { allowCredentials } : {})
    };

    const assertion = await navigator.credentials.get({
      publicKey: getOptions
    });

    if (!assertion) {
      throw new Error('Biometric authentication failed or was cancelled.');
    }

    const matchedKeyId = assertion.id || bufferToBase64Url(assertion.rawId);
    const matchedRecord = registered.find(k => k.id === matchedKeyId);
    if (!matchedRecord?.userId) {
      throw new Error('That passkey is not set up on this device. Sign in with your password.');
    }
    const refreshToken = readUnlocks()[matchedRecord.userId];
    const config = getSupabaseConfig();
    if (!refreshToken || !config.url || !config.anonKey) {
      throw new Error('Sign in with your password once on this device to use your passkey again.');
    }
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.anonKey },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.user?.id || !data.user?.email) {
      if (res.status === 400 || res.status === 401 || res.status === 403) writeUnlock(matchedRecord.userId, null);
      throw new Error('Your passkey sign-in has expired. Sign in with your password to use it again.');
    }
    const email = String(data.user.email).toLowerCase().trim();
    if (isTestAccountEmail(email)) { writeUnlock(matchedRecord.userId, null); throw new Error(TEST_ACCOUNT_MESSAGE); }
    const isOwner = MADSELKIE_EMAILS.includes(email);

    const userSession = {
      id: String(data.user.id),
      email,
      token: data.access_token,
      refreshToken: data.refresh_token || '',
      authProvider: 'passkey',
      username: isOwner ? 'madselkie' : (data.user.user_metadata?.username || email.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase()),
      displayName: isOwner ? 'madselkie' : (data.user.user_metadata?.display_name || email.split('@')[0]),
      createdAt: data.user.created_at || new Date().toISOString()
    };
    writeUnlock(userSession.id, userSession.refreshToken);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
      localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
    }

    return { success: true, user: userSession };
  } catch (err) {
    const errorMsg = err.name === 'NotAllowedError'
      ? 'Passkey authentication was cancelled or timed out.'
      : (err.message || 'Passkey authentication failed.');
    return { success: false, error: errorMsg };
  }
}

