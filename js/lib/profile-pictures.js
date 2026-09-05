/* ============================================================
   TOOLBOX — Profile Pictures & Avatar Registry
   Provides avatar definitions, default minimal silhouette placeholder,
   and reactive avatar rendering across settings, header, and Spaces.
   ============================================================ */

export const PROFILE_PICTURES = [
  {
    id: 'default',
    name: 'Minimal Silhouette',
    src: null,
    story: 'The enigmatic ghost in the machine. No face, no identity, just pure incognito capability. Perfect for when you want your code to do all the talking.'
  },
  {
    id: 'Lara.jpg',
    name: 'Lara Croft',
    src: '/profile-pictures/Lara.jpg',
    story: 'Tomb-raiding archaeologist with dual pistols and an appetite for ancient traps. Debugs legacy codebases by dodging rolling boulders and swinging across chasms.'
  },
  {
    id: 'Tanya.jpg',
    name: 'Tanya',
    src: '/profile-pictures/Tanya.jpg',
    story: 'Deadly Edenian turncoat with explosive agility and zero loyalty to buggy systems. She never came here to negotiate—only to deliver a flawless victory.'
  },
  {
    id: 'adalovelace.jpg',
    name: 'Ada Lovelace',
    src: '/profile-pictures/adalovelace.jpg',
    story: "The world's very first computer programmer. Saw the poetry in analytical engines two centuries ahead of everyone else. Mother of all modern software."
  },
  {
    id: 'beethoven.jpg',
    name: 'Beethoven',
    src: '/profile-pictures/beethoven.jpg',
    story: 'Composed the 9th Symphony while stone-deaf. If Ludwig could orchestrate transcendent symphonies without audio feedback, you can definitely fix this deployment.'
  },
  {
    id: 'burnaboy.jpg',
    name: 'Burna Boy',
    src: '/profile-pictures/burnaboy.jpg',
    story: 'The African Giant. Grammy-winning Afrofusion royalty, twice as tall, and utterly unapologetic. For when your code commands stadium-filling reverence.'
  },
  {
    id: 'cr7.jpg',
    name: 'Cristiano Ronaldo',
    src: '/profile-pictures/cr7.jpg',
    story: 'SIUUU! Five Ballon d\'Ors, endless gym reps, and an obsessive hatred of losing. Calm down—the clutch pull request is hitting the top corner in the 90th minute.'
  },
  {
    id: 'davido.jpg',
    name: 'Davido',
    src: '/profile-pictures/davido.jpg',
    story: 'O.B.O. Timeless chart-topper, billionaire energy, and boundless generosity. We rise by lifting others—and by shipping zero-defect releases before deadline.'
  },
  {
    id: 'donald.jpg',
    name: 'Donald',
    src: '/profile-pictures/donald.jpg',
    story: 'The art of the deal. Huge commits, tremendous performance, believe me. Nobody builds better interfaces than this—everybody agrees, it\'s incredible.'
  },
  {
    id: 'elon.jpg',
    name: 'Elon Musk',
    src: '/profile-pictures/elon.jpg',
    story: 'Electric hypercars, reusable rockets, neural links, and late-night memes. Why solve terrestrial bugs when we could introduce brand-new ones on Mars?'
  },
  {
    id: 'ezio.jpg',
    name: 'Ezio Auditore',
    src: '/profile-pictures/ezio.jpg',
    story: 'Master Assassin of Renaissance Florence. Silent blade, rooftop parkour, and a personal vendetta against memory leaks. Requiescat in pace, bugs.'
  },
  {
    id: 'khabylame.jpg',
    name: 'Khaby Lame',
    src: '/profile-pictures/khabylame.jpg',
    story: 'Points silently with both palms open. Why write a 500-line convoluted microservice when a 2-line standard function does the exact same thing without drama?'
  },
  {
    id: 'kratos.jpg',
    name: 'Kratos',
    src: '/profile-pictures/kratos.jpg',
    story: 'The Ghost of Sparta. Demolished the entire Greek pantheon and restructured Scandinavia. One word: "Boy." You do not argue with his architectural decisions.'
  },
  {
    id: 'messi.jpg',
    name: 'Lionel Messi',
    src: '/profile-pictures/messi.jpg',
    story: 'La Pulga. 8 Ballon d\'Ors, World Cup legend, defying the laws of physics with effortless grace. Makes insurmountable coding problems look like child\'s play.'
  },
  {
    id: 'miakhalifa.jpg',
    name: 'Mia',
    src: '/profile-pictures/miakhalifa.jpg',
    story: 'Cultural icon, internet royalty, and spectacles enthusiast. Always commands 100% of the room\'s attention, regardless of what\'s in the commit logs.'
  },
  {
    id: 'mrbeast.jpg',
    name: 'MrBeast',
    src: '/profile-pictures/mrbeast.jpg',
    story: '"I just trapped 100 developers in a single Docker container, and whoever fixes this concurrency race condition first wins a private island!" Extreme energy.'
  },
  {
    id: 'scorpion.jpg',
    name: 'Scorpion',
    src: '/profile-pictures/scorpion.jpg',
    story: '"GET OVER HERE!" Netherrealm ninja, hellfire master, and kunai spear marksman. Never lets an errant background task escape execution.'
  },
  {
    id: 'tinubu.jpg',
    name: 'Tinubu',
    src: '/profile-pictures/tinubu.jpg',
    story: 'The Jagaban of Borgu. Emilokan. Grandmaster of political strategy and economic recalibration. Whether the market fluctuates or not, the structure remains intact.'
  },
  {
    id: 'triborg.jpg',
    name: 'Triborg',
    src: '/profile-pictures/triborg.jpg',
    story: 'Cyber Lin Kuei lethal prototype combining Sektor, Cyrax, Smoke, and Cyber Sub-Zero. Maximum automation, zero organic fatigue, infinite uptime.'
  },
  {
    id: 'v.jpg',
    name: 'V',
    src: '/profile-pictures/v.jpg',
    story: 'Night City mercenary surviving with a legendary rockerboy in their head. Wake up, samurai—we\'ve got an entire production codebase to burn.'
  },
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
