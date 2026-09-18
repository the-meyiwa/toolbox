export default {
  render(container) {
    container.innerHTML = `
      <div style="padding:20px; max-width:800px; margin:0 auto;">
        <h2 style="margin-bottom:15px;">Music Search (via iTunes API) & Spotify Player</h2>
        <div style="display:flex; gap:10px; margin-bottom:20px;">
          <input type="text" id="spotify-search" class="tool-input" placeholder="Search for a track..." style="flex:1;">
          <button id="spotify-search-btn" class="btn btn-primary">Search</button>
        </div>
        <div id="spotify-results" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;"></div>
        <div id="spotify-player-container"></div>
      </div>
    `;
    
    const searchInput = container.querySelector('#spotify-search');
    const searchBtn = container.querySelector('#spotify-search-btn');
    const results = container.querySelector('#spotify-results');
    const player = container.querySelector('#spotify-player-container');
    
    searchBtn.addEventListener('click', async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      results.innerHTML = '<p>Searching...</p>';
      
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=5`);
        const data = await res.json();
        
        if (!data.results || data.results.length === 0) {
          results.innerHTML = '<p>No results found.</p>';
          return;
        }
        
        results.innerHTML = '';
        data.results.forEach(track => {
          const div = document.createElement('div');
          div.style.cssText = 'padding:10px; border:1px solid var(--border); border-radius:8px; display:flex; justify-content:space-between; align-items:center; background:var(--surface);';
          div.innerHTML = `
            <div>
              <div style="font-weight:bold;">${track.trackName}</div>
              <div style="font-size:0.85rem; color:var(--text-muted);">${track.artistName}</div>
            </div>
            <button class="btn btn-secondary btn-sm play-btn" data-url="${track.previewUrl}">Play Preview</button>
          `;
          results.appendChild(div);
        });
        
        results.querySelectorAll('.play-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            player.innerHTML = `
              <div style="padding: 16px; background: var(--bg-subtle); border-radius: 12px; border: 1px solid var(--border);">
                <p style="margin: 0 0 10px 0; font-weight: 600;">Audio Preview</p>
                <audio controls src="${url}" style="width: 100%; border-radius: 8px;"></audio>
              </div>`;
          });
        });
      } catch (err) {
        results.innerHTML = '<p>Error searching music.</p>';
      }
    });
  },
  getContextMenu() {
    return [
      { label: 'Clear Player', action: () => { const p = document.getElementById('spotify-player-container'); if(p) p.innerHTML=''; } }
    ];
  }
};
