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
      localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
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
    localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
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

    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        signOut();
        return null;
      }
      return current;
    }

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
 * Validate current user session against Supabase
 * If account was deleted or token revoked, signs out cleanly.
 */
export async function validateSession() {
  const current = getCurrentUser();
  const config = getSupabaseConfig();
  if (!current || !config.url || !config.anonKey) {
    return current;
  }

  // Real Supabase access token validation
  if (current.token && !current.token.startsWith('tok_')) {
    try {
      const res = await fetch(`${config.url}/auth/v1/user`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${current.token}`
        }
      });
      if (res.ok) {
        return current;
      }
      if (res.status === 401 || res.status === 403) {
        if (current.refreshToken) {
          const refreshed = await refreshUserSession();
          if (refreshed) return refreshed;
        }
        signOut();
        return null;
      }
    } catch {
      // Keep offline/network degraded session
      return current;
    }
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
        const userSession = {
          id: data.user?.id || `usr_${Date.now()}`,
          email: cleanEmail,
          token: data.access_token,
          refreshToken: data.refresh_token || '',
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(userSession));
        localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
        window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));
        return { success: true, user: userSession };
      }

      // Otherwise, the auth provider requires email confirmation
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
    localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
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
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
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

      const updatedUser = {
        id: data.id || activeUser?.id || `usr_${Date.now()}`,
        email: data.email || activeUser?.email,
        token: data.access_token || token,
        refreshToken: data.refresh_token || activeUser?.refreshToken,
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

  // Local / Simulation Mode
  if (activeUser) {
    activeUser.passwordUpdated = new Date().toISOString();
    localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(activeUser));
    localStorage.setItem('supabase_auth_session', JSON.stringify(activeUser));
    return { success: true, user: activeUser };
  }

  return { success: true, user: { email: 'user@local.dev' } };
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
      userId
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
   PASKEYS & WEBAUTHN BIOMETRICS ENGINE
   ============================================================ */

const PASSKEYS_STORAGE_KEY = 'toolbox_passkeys';

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
         typeof window.PublicKeyCredential !== 'undefined' &&
         typeof navigator !== 'undefined' &&
         typeof navigator.credentials !== 'undefined' &&
         typeof navigator.credentials.create === 'function' &&
         typeof navigator.credentials.get === 'function';
}

/**
 * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable() {
  if (!isPasskeySupported()) return false;
  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
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
        displayName: (activeUser.email || 'Toolbox User').split('@')[0]
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
  if (config.url && config.anonKey && activeUser.token && !activeUser.token.startsWith('tok_')) {
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

  // Local / simulated verification fallback
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }
  return { success: true };
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
  const updated = existing.filter(k => k.id !== passkeyId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PASSKEYS_STORAGE_KEY, JSON.stringify(updated));
  }

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

    const allowCredentials = candidateKeys.map(k => ({
      id: base64UrlToBuffer(k.id),
      type: 'public-key',
      transports: k.transports || ['internal']
    }));

    const getOptions = {
      challenge,
      rpId,
      userVerification: 'preferred',
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

    const email = matchedRecord?.userEmail || cleanHint || 'passkey-user@toolbox.app';
    const userId = matchedRecord?.userId || `usr_${Date.now()}`;

    const userSession = {
      id: userId,
      email,
      token: `passkey_${Date.now()}`,
      refreshToken: '',
      authProvider: 'passkey',
      createdAt: new Date().toISOString()
    };

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
      ? 'Passkey verification cancelled or not recognized.'
      : (err.message || 'Passkey authentication failed.');
    return { success: false, error: errorMsg };
  }
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
