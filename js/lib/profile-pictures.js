/* ============================================================
   TOOLBOX — Profile Pictures & Avatar Registry
   Provides avatar definitions, default minimal silhouette placeholder,
   and reactive avatar rendering across settings, header, and Spaces.
   ============================================================ */

export const PROFILE_PICTURES = [
  { id: 'default', name: 'Minimal Silhouette', src: null },
  { id: 'Lara.jpg', name: 'Lara Croft', src: '/profile-pictures/Lara.jpg' },
  { id: 'Tanya.jpg', name: 'Tanya', src: '/profile-pictures/Tanya.jpg' },
  { id: 'adalovelace.jpg', name: 'Ada Lovelace', src: '/profile-pictures/adalovelace.jpg' },
  { id: 'beethoven.jpg', name: 'Beethoven', src: '/profile-pictures/beethoven.jpg' },
  { id: 'burnaboy.jpg', name: 'Burna Boy', src: '/profile-pictures/burnaboy.jpg' },
  { id: 'cr7.jpg', name: 'Cristiano Ronaldo', src: '/profile-pictures/cr7.jpg' },
  { id: 'davido.jpg', name: 'Davido', src: '/profile-pictures/davido.jpg' },
  { id: 'donald.jpg', name: 'Donald', src: '/profile-pictures/donald.jpg' },
  { id: 'elon.jpg', name: 'Elon Musk', src: '/profile-pictures/elon.jpg' },
  { id: 'ezio.jpg', name: 'Ezio', src: '/profile-pictures/ezio.jpg' },
  { id: 'khabylame.jpg', name: 'Khaby Lame', src: '/profile-pictures/khabylame.jpg' },
  { id: 'kratos.jpg', name: 'Kratos', src: '/profile-pictures/kratos.jpg' },
  { id: 'messi.jpg', name: 'Lionel Messi', src: '/profile-pictures/messi.jpg' },
  { id: 'miakhalifa.jpg', name: 'Mia', src: '/profile-pictures/miakhalifa.jpg' },
  { id: 'mrbeast.jpg', name: 'MrBeast', src: '/profile-pictures/mrbeast.jpg' },
  { id: 'scorpion.jpg', name: 'Scorpion', src: '/profile-pictures/scorpion.jpg' },
  { id: 'tinubu.jpg', name: 'Tinubu', src: '/profile-pictures/tinubu.jpg' },
  { id: 'triborg.jpg', name: 'Triborg', src: '/profile-pictures/triborg.jpg' },
  { id: 'v.jpg', name: 'V', src: '/profile-pictures/v.jpg' },
];

export function getProfilePictureSrc(id) {
  if (!id || id === 'default') return null;
  const found = PROFILE_PICTURES.find(p => p.id === id);
  return found?.src || `/profile-pictures/${id}`;
}

export function getUserAvatarHtml(userOrId, size = 32, className = '') {
  let pictureId = 'default';

  if (typeof userOrId === 'string') {
    pictureId = userOrId;
  } else if (userOrId && typeof userOrId === 'object') {
    pictureId = userOrId.profilePicture || userOrId.user_metadata?.profile_picture || userOrId.avatarUrl || 'default';
  }

  const src = getProfilePictureSrc(pictureId);
  const iconSize = Math.max(14, Math.round(size * 0.55));

  if (src) {
    return `
      <img src="${src}" alt="Profile Picture" class="${className}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; border:1px solid var(--border); display:inline-block; vertical-align:middle; background:var(--bg-subtle);" onerror="this.style.display='none'; this.nextElementSibling ? this.nextElementSibling.style.display='flex' : null;" />
      <div style="display:none; width:${size}px; height:${size}px; border-radius:50%; background:var(--bg-subtle); border:1px solid var(--border); align-items:center; justify-content:center; color:var(--text);">
        <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `;
  }

  return `
    <div class="${className}" style="width:${size}px; height:${size}px; border-radius:50%; background:var(--bg-subtle); border:1px solid var(--border); display:inline-flex; align-items:center; justify-content:center; color:var(--text); vertical-align:middle;">
      <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
  `;
}
