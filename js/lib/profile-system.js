/* Legacy compatibility facade. Live discovery is implemented by user-directory.js. */
import { getCurrentUser, updateUserProfile } from './supabase.js';
import { getProfilePictureSrc } from './profile-pictures.js';

export const DEFAULT_MOCK_PROFILES = [];

export function getMyProfile() {
  const user = getCurrentUser();
  if (!user) return null;
  const name = user.displayName || user.user_metadata?.display_name || user.username || user.email?.split('@')[0] || 'Toolbox User';
  const avatarUrl = user.avatarUrl || user.user_metadata?.avatar_url || getProfilePictureSrc(user.profilePicture || user.user_metadata?.profile_picture || 'default');
  return { id:user.id, username:user.username || user.user_metadata?.username || '', name, email:user.email, affiliation:'Toolbox User', bio:'', avatarUrl, avatar:name.slice(0,2).toUpperCase() };
}

export function updateMyProfile(patch) {
  const updated = updateUserProfile({ username:patch?.username, displayName:patch?.name, avatarUrl:patch?.avatarUrl, profilePicture:patch?.profilePicture });
  return updated ? getMyProfile() : null;
}

export function getPublicProfiles() { return []; }
export function searchPublicProfiles() { return []; }
