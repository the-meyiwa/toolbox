import { getCurrentUser, getSupabaseConfig } from './supabase.js';
import { avatarSrcOf } from './profile-pictures.js';

const clean = value => String(value || '').trim();
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const headers = () => {
  const user = getCurrentUser();
  const { anonKey } = getSupabaseConfig();
  return { apikey: anonKey, Authorization: `Bearer ${user?.token || anonKey}`, 'Content-Type': 'application/json' };
};

function normalize(profile) {
  if (!profile) return null;
  const picture = avatarSrcOf(profile);
  return { id: profile.id, email: profile.email, username: profile.username, name: profile.display_name || profile.username || profile.email?.split('@')[0], avatarUrl: picture, profilePicture: profile.profile_picture };
}

export async function searchToolboxUsers(query, limit = 20) {
  const user = getCurrentUser();
  if (!user) return [];
  const { url } = getSupabaseConfig();
  const q = clean(query).replace(/^@/, '');
  const response = await fetch(`${url}/rest/v1/rpc/search_message_profiles`, { method: 'POST', headers: headers(), body: JSON.stringify({ search_query: q, result_limit: Math.max(1, Math.min(50, Number(limit) || 20)) }) });
  if (!response.ok) throw new Error('Could not search Toolbox users. Run the messaging database migration.');
  return (await response.json()).filter(item => item.id !== user.id).map(normalize);
}

export async function findToolboxUserByEmail(email) {
  const user = getCurrentUser();
  if (!user || !clean(email)) return null;
  return (await searchToolboxUsers(clean(email).toLowerCase(), 1))[0] || null;
}

export function avatarMarkup(profile, size = 36) {
  size = Math.max(16, Math.min(256, Number(size) || 36));
  const style = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex:0 0 auto`;
  const src = avatarSrcOf(profile);
  if (src && (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src) || /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src))) return `<img src="${escape(src)}" alt="" style="${style}" referrerpolicy="no-referrer">`;
  const initials = clean(profile?.name || profile?.email || '?').slice(0, 2).toUpperCase();
  return `<span class="directory-avatar-fallback" style="${style};display:grid;place-items:center;background:var(--accent);color:var(--accent-contrast,var(--surface));font-weight:700">${escape(initials)}</span>`;
}
