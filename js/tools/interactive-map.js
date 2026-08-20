let leafletLoaded = false;

export default {
  async render(container) {
    container.innerHTML = `
      <div class="tool-content" style="display:flex; flex-direction:column; height: 100%; min-height: 500px;">
        
        <div class="tool-section" style="display:flex; gap:8px; margin-bottom:12px;">
          <input type="text" class="tool-input" id="map-search-input" placeholder="Search for a city, address, or landmark…" style="flex:1;">
          <button class="btn btn-primary" id="map-search-btn">Find</button>
        </div>

        <div id="map-status" style="text-align:center; padding:40px; color:var(--g500);">
          Loading the map…
        </div>

        <div id="map-container" style="flex:1; width:100%; min-height: 400px; border-radius:8px; border:2px solid var(--black); display:none; z-index:1;"></div>
      </div>
    `;

    const searchInput = container.querySelector('#map-search-input');
    const searchBtn = container.querySelector('#map-search-btn');
    const mapDiv = container.querySelector('#map-container');
    const statusDiv = container.querySelector('#map-status');

    // Leaflet is fetched on demand. An onerror path matters here: without one
    // a blocked or offline CDN left the promise pending and the tool stuck on
    // "Loading the map…" for ever.
    if (!leafletLoaded) {
      const load = (make) => new Promise((resolve, reject) => {
        const el = make();
        el.onload = resolve;
        el.onerror = () => reject(new Error('asset failed to load'));
        document.head.appendChild(el);
      });

      try {
        await Promise.all([
          load(() => Object.assign(document.createElement('link'), {
            rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
          })),
          load(() => Object.assign(document.createElement('script'), {
            src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
          })),
        ]);
        leafletLoaded = true;
      } catch {
        statusDiv.textContent = 'The map could not be loaded. Check your connection, or any extension blocking it, and reopen this tool.';
        return;
      }
    }

    statusDiv.style.display = 'none';
    mapDiv.style.display = 'block';

    // Initialize Map
    const map = L.map(mapDiv).setView([20, 0], 2); // Default to world view

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let currentMarker = null;

    function say(message) {
      statusDiv.textContent = message;
      statusDiv.style.display = message ? 'block' : 'none';
      statusDiv.style.padding = message ? '10px 0 0' : '';
    }

    async function searchLocation() {
      const q = searchInput.value.trim();
      if (!q) return;

      say('');
      searchBtn.disabled = true;
      searchBtn.textContent = 'Finding…';
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
          say(`Nothing found for “${q}”. Try a fuller address, or add the country.`);
        }
      } catch {
        say('That search could not be completed. Check your connection and try again.');
      }
      searchBtn.disabled = false;
      searchBtn.textContent = 'Find';
    }

    searchBtn.addEventListener('click', searchLocation);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchLocation(); });

    // The container is hidden while Leaflet initialises, so it has to be told
    // to measure itself once it is on screen.
    this._resize = setTimeout(() => map.invalidateSize(), 100);
    this._map = map;
  },

  destroy() {
    clearTimeout(this._resize);
    // Leaflet keeps window listeners and tile requests alive until told
    // otherwise; without this the map leaks every time the tool is opened.
    this._map?.remove();
    this._map = null;
  },
};
