let leafletLoaded = false;

export default {
  async render(container) {
    container.innerHTML = `
      <div class="tool-content" style="display:flex; flex-direction:column; height: 100%; min-height: 500px;">
        <h2 class="tool-title" style="font-family:var(--pixel);">Interactive Map</h2>
        <p class="tool-desc">Search, pan, and zoom across the globe instantly.</p>
        
        <div class="tool-section" style="display:flex; gap:8px; margin-bottom:12px;">
          <input type="text" class="tool-input" id="map-search-input" placeholder="Search for a city, address, or landmark..." style="flex:1;">
          <button class="btn btn-primary" id="map-search-btn">Find</button>
        </div>

        <div id="map-loading" style="text-align:center; padding:40px; color:var(--g500);">
          Loading map engine...
        </div>

        <div id="map-container" style="flex:1; width:100%; min-height: 400px; border-radius:8px; border:2px solid var(--black); display:none; z-index:1;"></div>
      </div>
    `;

    const searchInput = container.querySelector('#map-search-input');
    const searchBtn = container.querySelector('#map-search-btn');
    const mapDiv = container.querySelector('#map-container');
    const loadingDiv = container.querySelector('#map-loading');
    
    // Load Leaflet dynamically
    if (!leafletLoaded) {
      await Promise.all([
        new Promise(resolve => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.onload = resolve;
          document.head.appendChild(link);
        }),
        new Promise(resolve => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          document.head.appendChild(script);
        })
      ]);
      leafletLoaded = true;
    }

    loadingDiv.style.display = 'none';
    mapDiv.style.display = 'block';

    // Initialize Map
    const map = L.map(mapDiv).setView([20, 0], 2); // Default to world view

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    let currentMarker = null;

    async function searchLocation() {
      const q = searchInput.value.trim();
      if (!q) return;

      searchBtn.textContent = '...';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const data = await res.json();
        
        if (data && data.length > 0) {
          const loc = data[0];
          const lat = parseFloat(loc.lat);
          const lon = parseFloat(loc.lon);

          map.setView([lat, lon], 12);
          
          if (currentMarker) map.removeLayer(currentMarker);
          currentMarker = L.marker([lat, lon]).addTo(map).bindPopup(loc.display_name).openPopup();
        } else {
          alert('Location not found.');
        }
      } catch (e) {
        alert('Error searching for location.');
      }
      searchBtn.textContent = 'Find';
    }

    searchBtn.addEventListener('click', searchLocation);
    searchInput.addEventListener('keypress', e => e.key === 'Enter' && searchLocation());

    // Fix map rendering issue when container is initially hidden
    setTimeout(() => { map.invalidateSize(); }, 100);
  },
  destroy() {}
};
