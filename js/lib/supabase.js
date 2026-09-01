/* ============================================================
   TOOLBOX — Supabase Integration & Dual Storage Engine
   Manages user authentication, cloud storage synchronization,
   PostgreSQL database operations, and persistent online storage.
   ============================================================ */

const STORAGE_MODE_KEY = 'toolbox_storage_mode'; // 'local' | 'supabase'
const SUPABASE_SESSION_KEY = 'toolbox_supabase_session';
const SUPABASE_CUSTOM_URL_KEY = 'toolbox_supabase_url';
const SUPABASE_CUSTOM_KEY_KEY = 'toolbox_supabase_anon_key';

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
 * Get current user session
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.token) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

      const userSession = {
        id: data.user?.id || `usr_${Date.now()}`,
        email: data.user?.email || cleanEmail,
        token: data.access_token,
        refreshToken: data.refresh_token,
        createdAt: data.user?.created_at || new Date().toISOString()
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
      return { success: true, user: userSession };
    }

    // Local / Dev Account simulation when no external Supabase URL is set
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

  if (config.url && config.anonKey) {
    const res = await fetch(`${config.url}/storage/v1/object/${bucketName}/${filePath}`, {
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
    return { path: filePath, url: `${config.url}/storage/v1/object/public/${bucketName}/${filePath}` };
  }

  // Fallback storage URL
  return { path: filePath, url: `https://supabase-storage-mock.local/${bucketName}/${filePath}` };
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
 * P2P Signaling: Send WebRTC signal via Supabase REST
 */
export async function sendP2PSignal(roomCode, senderId, messageType, payload) {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return;
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
  } catch {}
}

/**
 * P2P Signaling: Poll WebRTC signals via Supabase REST
 */
export async function pollP2PSignals(roomCode, sinceDate) {
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
