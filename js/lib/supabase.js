/* ============================================================
   TOOLBOX — Supabase Integration & Dual Storage Engine
   Manages user authentication, cloud storage synchronization,
   PostgreSQL database operations, and persistent online storage.
   ============================================================ */

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
export function updateUserProfile({ username, displayName, avatarUrl, profilePicture, username_changed_at } = {}) {
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

  return updated;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const config = getSupabaseConfig();
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

      const isOwner = MADSELKIE_EMAILS.includes(cleanEmail);
      const userSession = {
        id: data.user?.id || `usr_${Date.now()}`,
        email: data.user?.email || cleanEmail,
        token: data.access_token,
        refreshToken: data.refresh_token,
        username: isOwner ? 'madselkie' : (data.user?.user_metadata?.username || cleanEmail.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase()),
        displayName: isOwner ? 'madselkie' : (data.user?.user_metadata?.display_name || cleanEmail.split('@')[0]),
        createdAt: data.user?.created_at || new Date().toISOString()
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
      return { success: true, user: userSession };
    }

    // Local / Dev Account simulation when no external Supabase URL is set
    const isOwner = MADSELKIE_EMAILS.includes(cleanEmail);
    const userSession = {
      id: `usr_${btoa(cleanEmail).slice(0, 10)}`,
      email: cleanEmail,
      token: `tok_${Date.now()}`,
      username: isOwner ? 'madselkie' : cleanEmail.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase(),
      displayName: isOwner ? 'madselkie' : cleanEmail.split('@')[0],
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
    return { success: true, user: userSession };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Refresh current user session using refresh token
 */
export async function refreshUserSession() {
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

    if (!res.ok) return current;

    const data = await res.json();
    if (data.access_token) {
      const updated = {
        ...current,
        token: data.access_token,
        refreshToken: data.refresh_token || current.refreshToken,
        id: data.user?.id || current.id,
        email: data.user?.email || current.email
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: updated } }));
      return updated;
    }
  } catch (e) {
    console.warn('Failed to refresh user session:', e);
  }
  return current;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const config = getSupabaseConfig();
  try {
    if (config.url && config.anonKey) {
      const res = await fetch(`${config.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey
        },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error_description || data.message || data.msg || 'Sign up failed';
        throw new Error(errorMsg);
      }

      // If Supabase returned an access_token directly (instant confirmation)
      if (data.access_token) {
        const userSession = {
          id: data.user?.id || `usr_${Date.now()}`,
          email: cleanEmail,
          token: data.access_token,
          refreshToken: data.refresh_token || '',
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
        window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
        return { success: true, user: userSession };
      }

      // If no token was returned in signup, try immediate sign in
      // (works automatically if auto-confirm trigger is installed or account is active)
      const immediateLogin = await signInWithEmail(cleanEmail, password);
      if (immediateLogin.success) {
        return immediateLogin;
      }

      // Otherwise, the auth provider strictly enforces email confirmation link
      return { success: true, requiresConfirmation: true };
    }

    // Dev Account simulation
    const userSession = {
      id: `usr_${btoa(cleanEmail).slice(0, 10)}`,
      email: cleanEmail,
      token: `tok_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
    return { success: true, user: userSession };
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
    // Reset storage strategy to Browser/Local when signed out
    localStorage.setItem(STORAGE_MODE_KEY, 'local');
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: null } }));
    window.dispatchEvent(new CustomEvent('toolbox:storagemodechange', { detail: { mode: 'local' } }));
  } catch {}
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

  if (config.url && config.anonKey) {
    const res = await fetch(`${config.url}/storage/v1/object/${bucketName}/${safePath}`, {
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
    return { path: safePath, url: `${config.url}/storage/v1/object/public/${bucketName}/${safePath}` };
  }

  // Fallback storage URL
  return { path: safePath, url: `https://supabase-storage-mock.local/${bucketName}/${safePath}` };
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
export async function saveAssistantConversationToCloud(conversation) {
  const user = getCurrentUser();
  if (!user || !user.email) return false;

  const key = `${ASSISTANT_CLOUD_CONVERSATIONS_KEY}_${user.email}`;
  try {
    localStorage.setItem(key, JSON.stringify(conversation));
  } catch {}

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return true;

  try {
    await fetch(`${config.url}/rest/v1/assistant_conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token || config.anonKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_email: user.email,
        username: user.username || 'user',
        conversation_data: conversation,
        updated_at: new Date().toISOString()
      })
    });
    return true;
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

  try {
    const res = await fetch(`${config.url}/rest/v1/assistant_conversations?user_email=eq.${encodeURIComponent(user.email)}&select=*&limit=1`, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${user.token || config.anonKey}`
      }
    });
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

