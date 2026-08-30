/* ============================================================
   TOOLBOX — Supabase Integration & Dual Storage Engine
   Manages user authentication, cloud storage synchronization,
   and persistent online storage alongside zero-latency local storage.
   ============================================================ */

const STORAGE_MODE_KEY = 'toolbox_storage_mode'; // 'local' | 'supabase'
const SUPABASE_SESSION_KEY = 'toolbox_supabase_session';

// Configurable Supabase credentials (read from environment or local config)
export const SUPABASE_CONFIG = {
  url: import.meta.env?.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co',
  anonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key'
};

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
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  try {
    // If Supabase endpoint is live, send real request
    if (SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes('xyzcompany')) {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_CONFIG.anonKey
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.message || 'Login failed');
      
      const userSession = {
        id: data.user.id,
        email: data.user.email,
        token: data.access_token,
        createdAt: data.user.created_at || new Date().toISOString()
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
      return { success: true, user: userSession };
    }

    // Local / Dev Account simulation when no external Supabase URL is set
    const userSession = {
      id: `usr_${btoa(email).slice(0, 10)}`,
      email,
      token: `tok_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
    return { success: true, user: userSession };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email, password) {
  try {
    if (SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes('xyzcompany')) {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_CONFIG.anonKey
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.message || 'Sign up failed');
      
      const userSession = {
        id: data.user?.id || `usr_${Date.now()}`,
        email,
        token: data.access_token || '',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
      return { success: true, user: userSession };
    }

    // Dev Account simulation
    const userSession = {
      id: `usr_${btoa(email).slice(0, 10)}`,
      email,
      token: `tok_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
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
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: null } }));
  } catch {}
}

/**
 * Upload file to Supabase Storage Bucket
 */
export async function uploadToSupabaseStorage(bucketName, filePath, fileBlob) {
  const user = getCurrentUser();
  if (!user) throw new Error('You must be signed in to upload files to Supabase cloud storage.');

  if (SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes('xyzcompany')) {
    const res = await fetch(`${SUPABASE_CONFIG.url}/storage/v1/object/${bucketName}/${filePath}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${user.token}`
      },
      body: fileBlob
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Cloud storage upload failed.');
    }
    return { path: filePath, url: `${SUPABASE_CONFIG.url}/storage/v1/object/public/${bucketName}/${filePath}` };
  }

  // Fallback / mock storage URL
  return { path: filePath, url: `https://supabase-storage-mock.local/${bucketName}/${filePath}` };
}
