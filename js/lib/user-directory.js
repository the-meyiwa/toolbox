import { getCurrentUser, getSupabaseConfig } from './supabase.js';
import { getProfilePictureSrc } from './profile-pictures.js';

const clean = value => String(value || '').trim();
const headers = () => {
  const user = getCurrentUser();
  const { anonKey } = getSupabaseConfig();
  return { apikey: anonKey, Authorization: `Bearer ${user?.token || anonKey}`, 'Content-Type': 'application/json' };
};

function normalize(profile) {
  if (!profile) return null;
  const picture = profile.avatar_url || getProfilePictureSrc(profile.profile_picture || 'default');
  return { id: profile.id, email: profile.email, username: profile.username, name: profile.display_name || profile.username || profile.email?.split('@')[0], avatarUrl: picture, profilePicture: profile.profile_picture };
}

export async function searchToolboxUsers(query, limit = 20) {
  const user = getCurrentUser();
  if (!user) return [];
  const { url } = getSupabaseConfig();
  const q = clean(query).replace(/^@/, '');
  const filter = q ? `&or=(username.ilike.*${encodeURIComponent(q)}*,display_name.ilike.*${encodeURIComponent(q)}*,email.ilike.*${encodeURIComponent(q)}*)` : '';
  const response = await fetch(`${url}/rest/v1/profiles?select=id,email,username,display_name,avatar_url,profile_picture,messaging_enabled&messaging_enabled=eq.true${filter}&limit=${limit}`, { headers: headers() });
  if (!response.ok) throw new Error('Could not search Toolbox users. Run the messaging database migration.');
  return (await response.json()).filter(item => item.id !== user.id).map(normalize);
}

export async function findToolboxUserByEmail(email) {
  const user = getCurrentUser();
  if (!user || !clean(email)) return null;
  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/profiles?select=id,email,username,display_name,avatar_url,profile_picture&email=eq.${encodeURIComponent(clean(email).toLowerCase())}&limit=1`, { headers: headers() });
  if (!response.ok) return null;
  return normalize((await response.json())[0]);
}

export function avatarMarkup(profile, size = 36) {
  const style = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex:0 0 auto`;
  if (profile?.avatarUrl) return `<img src="${profile.avatarUrl}" alt="" style="${style}">`;
  const initials = clean(profile?.name || profile?.email || '?').slice(0, 2).toUpperCase();
  return `<span class="directory-avatar-fallback" style="${style};display:grid;place-items:center;background:var(--accent);color:var(--accent-contrast,var(--surface));font-weight:700">${initials}</span>`;
}
