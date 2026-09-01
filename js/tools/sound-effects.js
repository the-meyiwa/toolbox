/* ============================================================
   TOOLBOX — Sound Effects
   Search and play real sound effects and audio clips using the 
   iTunes API with loop controls and favorites.
   ============================================================ */

export default {
  activeAudios: [],

  render(container) {
    let searchQuery = 'sound effect';
    let volumeLevel = 1.0;
    let isLooping = false;
    let favorites = JSON.parse(localStorage.getItem('toolbox_sfx_favs_v2') || '[]');

    container.innerHTML = `
      <div class="tool-section" style="max-width:1200px; margin:0 auto;">
        <!-- Top Controls Bar -->
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:16px 20px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div>
            <h2 style="margin:0 0 4px; font-size:1.15rem; font-weight:700;">Sound Effects & Audio Foley</h2>
            <div style="font-size:0.8rem; color:var(--g600);">Search and play millions of real audio clips online.</div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <!-- Volume Control -->
            <div style="display:flex; align-items:center; gap:6px;">
              <label class="calc-label" style="margin:0;">Vol:</label>
              <input type="range" id="sfx-volume" min="0" max="1.0" step="0.05" value="1.0" style="width:75px;">
              <span id="sfx-vol-val" style="font-size:0.75rem; font-family:var(--mono); width:32px;">100%</span>
            </div>

            <!-- Loop Mode Toggle -->
            <button type="button" class="btn btn-secondary btn-sm" id="sfx-loop-btn">Loop: Off</button>
            <button type="button" class="btn btn-secondary btn-sm" id="sfx-stop-all" style="color:#ef4444;">Stop All</button>
          </div>
        </div>

        <!-- Search & Filter Bar -->
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
          <form id="sfx-search-form" style="display:flex; gap:10px;">
            <input type="text" id="sfx-search" class="tool-input" placeholder="Search (e.g. laser, explosion, applause)..." style="flex:1; font-size:0.88rem; padding:8px 14px;">
            <button type="submit" class="btn btn-primary btn-sm">Search</button>
            <button type="button" class="btn btn-secondary btn-sm" id="sfx-fav-filter">Favorites (<span id="sfx-fav-count">0</span>)</button>
          </form>

          <!-- Quick Searches -->
          <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;" id="sfx-category-bar">
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect meme">Memes</button>
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect 8-bit">Gaming</button>
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect cinematic impact">Cinematic</button>
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect foley">Foley</button>
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect weapon">Weapons</button>
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect UI alert">UI Alerts</button>
            <button type="button" class="btn btn-secondary btn-sm sfx-cat-btn" data-q="sound effect nature">Nature</button>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div id="sfx-loading" style="display:none; padding:40px; text-align:center; color:var(--g500);">Searching online database...</div>

        <!-- Sound Pads Grid -->
        <div id="sfx-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px;"></div>
      </div>
    `;

    const sfxGrid = container.querySelector('#sfx-grid');
    const searchForm = container.querySelector('#sfx-search-form');
    const searchInput = container.querySelector('#sfx-search');
    const volumeSlider = container.querySelector('#sfx-volume');
    const volVal = container.querySelector('#sfx-vol-val');
    const loopBtn = container.querySelector('#sfx-loop-btn');
    const stopAllBtn = container.querySelector('#sfx-stop-all');
    const favFilterBtn = container.querySelector('#sfx-fav-filter');
    const favCountEl = container.querySelector('#sfx-fav-count');
    const catBtns = container.querySelectorAll('.sfx-cat-btn');
    const loadingEl = container.querySelector('#sfx-loading');

    let showFavsOnly = false;
    let currentResults = [];
    
    updateFavCount();
    
    // Initial load
    fetchSounds('sound effect');

    volumeSlider.addEventListener('input', () => {
      volumeLevel = parseFloat(volumeSlider.value);
      volVal.textContent = `${Math.round(volumeLevel * 100)}%`;
      this.activeAudios.forEach(a => a.volume = volumeLevel);
    });

    loopBtn.addEventListener('click', () => {
      isLooping = !isLooping;
      loopBtn.textContent = `Loop: ${isLooping ? 'On' : 'Off'}`;
      loopBtn.classList.toggle('btn-primary', isLooping);
      loopBtn.classList.toggle('btn-secondary', !isLooping);
      this.activeAudios.forEach(a => a.loop = isLooping);
    });

    stopAllBtn.addEventListener('click', () => {
      this.stopAll();
    });

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) {
        showFavsOnly = false;
        favFilterBtn.classList.remove('btn-primary');
        favFilterBtn.classList.add('btn-secondary');
        fetchSounds(`sound effect ${q}`);
      }
    });

    favFilterBtn.addEventListener('click', () => {
      showFavsOnly = !showFavsOnly;
      favFilterBtn.classList.toggle('btn-primary', showFavsOnly);
      favFilterBtn.classList.toggle('btn-secondary', !showFavsOnly);
      if (showFavsOnly) {
        currentResults = favorites;
        renderSounds(favorites);
      } else {
        const q = searchInput.value.trim() || 'sound effect';
        fetchSounds(q.includes('sound effect') ? q : `sound effect ${q}`);
      }
    });

    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        searchInput.value = q.replace('sound effect ', '');
        showFavsOnly = false;
        favFilterBtn.classList.remove('btn-primary');
        favFilterBtn.classList.add('btn-secondary');
        fetchSounds(q);
      });
    });

    function updateFavCount() {
      favCountEl.textContent = favorites.length;
      localStorage.setItem('toolbox_sfx_favs_v2', JSON.stringify(favorites));
    }

    async function fetchSounds(query) {
      sfxGrid.innerHTML = '';
      loadingEl.style.display = 'block';
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=30`);
        const data = await res.json();
        currentResults = data.results.filter(r => r.previewUrl).map(r => ({
          id: r.trackId.toString(),
          name: r.trackName,
          artist: r.artistName,
          previewUrl: r.previewUrl,
          artworkUrl: r.artworkUrl30 || ''
        }));
        loadingEl.style.display = 'none';
        renderSounds(currentResults);
      } catch (err) {
        console.error(err);
        loadingEl.style.display = 'none';
        sfxGrid.innerHTML = `<div style="grid-column:1/-1; padding:40px; text-align:center; color:#ef4444;">Failed to fetch sounds. Please check your connection.</div>`;
      }
    }

    const self = this;
    function renderSounds(items) {
      if (!items.length) {
        sfxGrid.innerHTML = `<div style="grid-column:1/-1; padding:40px; text-align:center; color:var(--g500);">No sounds found. Try a different search.</div>`;
        return;
      }

      sfxGrid.innerHTML = items.map((s) => {
        const isFav = favorites.some(f => f.id === s.id);
        return `
          <div class="sfx-card" data-id="${s.id}" style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.15s cubic-bezier(0.16,1,0.3,1);" title="Click to play ${s.name.replace(/"/g, '&quot;')}">
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
              ${s.artworkUrl ? `<img src="${s.artworkUrl}" style="width:30px; height:30px; border-radius:4px; object-fit:cover;">` : ''}
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;">
                <div style="font-weight:600; font-size:0.84rem; color:var(--black); overflow:hidden; text-overflow:ellipsis;">
                  ${s.name}
                </div>
                <div style="font-size:0.72rem; color:var(--g500); font-family:var(--mono); overflow:hidden; text-overflow:ellipsis;">${s.artist}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
              <button type="button" class="sfx-fav-btn" data-id="${s.id}" style="background:none; border:none; color:${isFav ? '#eab308' : 'var(--g300)'}; cursor:pointer; font-size:1.2rem; line-height:1; padding:4px;" title="Favorite">★</button>
              <button type="button" class="sfx-play-btn" data-id="${s.id}" style="width:28px; height:28px; border-radius:50%; background:var(--g100); border:1px solid var(--g200); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--black);">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');

      sfxGrid.querySelectorAll('.sfx-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.sfx-fav-btn')) return;
          const s = items.find(item => item.id === card.dataset.id);
          if (s) self.playSound(s, card, volumeLevel, isLooping);
        });
      });

      sfxGrid.querySelectorAll('.sfx-fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const item = items.find(i => i.id === id);
          if (!item) return;
          
          const existingIdx = favorites.findIndex(f => f.id === id);
          if (existingIdx >= 0) {
            favorites.splice(existingIdx, 1);
            btn.style.color = 'var(--g300)';
          } else {
            favorites.push(item);
            btn.style.color = '#eab308';
          }
          updateFavCount();
          if (showFavsOnly) renderSounds(favorites);
        });
      });
    }
  },

  playSound(s, cardEl, volumeLevel, isLooping) {
    this.stopAll();

    if (cardEl) {
      cardEl.style.transform = 'scale(0.97)';
      cardEl.style.borderColor = 'var(--black)';
      setTimeout(() => {
        cardEl.style.transform = '';
        cardEl.style.borderColor = 'var(--g200)';
      }, 150);
    }

    const audio = new Audio(s.previewUrl);
    audio.volume = volumeLevel;
    audio.loop = isLooping;
    audio.play().catch(e => console.error("Audio play failed:", e));

    this.activeAudios.push(audio);

    audio.addEventListener('ended', () => {
      this.activeAudios = this.activeAudios.filter(a => a !== audio);
    });
  },

  stopAll() {
    this.activeAudios.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeAudios = [];
  },

  destroy() {
    this.stopAll();
  }
};
