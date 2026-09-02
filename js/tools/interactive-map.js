let leafletLoaded = false;

export default {
  async render(container) {
    container.innerHTML = `
      <div class="tool-content" style="display:flex; flex-direction:column; height: 100%; min-height: 500px;">
        
        <div class="tool-section" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
          <input type="text" class="tool-input" id="map-search-input" placeholder="Search for a city, address, or landmark…" style="flex:1; min-width:220px; border-radius:9999px;">
          <button class="btn btn-primary" id="map-search-btn" style="border-radius:9999px; padding:0 20px;">Find</button>
          <button class="btn btn-secondary" id="map-locate-btn" style="border-radius:9999px; display:inline-flex; align-items:center; gap:6px; font-weight:600; padding:0 18px;" title="Center on your current GPS location">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="7"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <line x1="12" y1="1" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="23"/>
              <line x1="1" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="23" y2="12"/>
            </svg>
            <span>Current Location</span>
          </button>
        </div>

        <div id="map-status" style="text-align:center; padding:40px; color:var(--g500);">
          Loading the map…
        </div>

        <div id="map-container" style="flex:1; width:100%; min-height: 420px; border-radius:14px; border:1px solid var(--g300); display:none; z-index:1; overflow:hidden;"></div>
      </div>
    `;

    const searchInput = container.querySelector('#map-search-input');
    const searchBtn = container.querySelector('#map-search-btn');
    const locateBtn = container.querySelector('#map-locate-btn');
    const mapDiv = container.querySelector('#map-container');
    const statusDiv = container.querySelector('#map-status');

    // Leaflet is fetched on demand.
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
    let handoffMarkers = [];

    function say(message) {
      statusDiv.textContent = message;
      statusDiv.style.display = message ? 'block' : 'none';
      statusDiv.style.padding = message ? '10px 0 0' : '';
    }

    // Check Assistant Handoff
    try {
      const rawHandoff = sessionStorage.getItem('toolbox.map.handoff');
      if (rawHandoff) {
        const mapData = JSON.parse(rawHandoff);
        sessionStorage.removeItem('toolbox.map.handoff');
        if (Array.isArray(mapData.markers) && mapData.markers.length > 0) {
          const latLngs = [];
          mapData.markers.forEach(m => {
            const lat = Number(m.lat);
            const lng = Number(m.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
              latLngs.push([lat, lng]);
              const marker = L.marker([lat, lng]).addTo(map).bindPopup(`<strong>${m.name}</strong><br/>${m.description || ''}`);
              handoffMarkers.push(marker);
            }
          });

          if (latLngs.length > 1) {
            L.polyline(latLngs, { color: '#2563eb', weight: 3, dashArray: '6, 6' }).addTo(map);
            map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
          } else if (latLngs.length === 1) {
            map.setView(latLngs[0], 13);
            handoffMarkers[0]?.openPopup();
          }
        }
      }
    } catch {}

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

          map.setView([lat, lon], 13);

          if (currentMarker) map.removeLayer(currentMarker);
          currentMarker = L.marker([lat, lon]).addTo(map).bindPopup(loc.display_name).openPopup();
        } else {
          say(`Nothing found for "${q}". Try a fuller address, or add the city/country.`);
        }
      } catch {
        say('That search could not be completed. Check your connection and try again.');
      }
      searchBtn.disabled = false;
      searchBtn.textContent = 'Find';
    }

    function locateCurrent() {
      if (!navigator.geolocation) {
        say('Geolocation is not supported by your browser.');
        return;
      }

      say('');
      locateBtn.disabled = true;
      const labelSpan = locateBtn.querySelector('span');
      if (labelSpan) labelSpan.textContent = 'Locating…';

      navigator.geolocation.getCurrentPosition(
        (position) => {
          locateBtn.disabled = false;
          if (labelSpan) labelSpan.textContent = 'Current Location';

          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          map.setView([lat, lon], 15);

          if (currentMarker) map.removeLayer(currentMarker);
          currentMarker = L.marker([lat, lon]).addTo(map).bindPopup('<strong>Your Current Location</strong>').openPopup();
        },
        (error) => {
          locateBtn.disabled = false;
          if (labelSpan) labelSpan.textContent = 'Current Location';
          say(`Could not retrieve your location (${error.message || 'Permission denied'}). Please allow location access in your browser.`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }

    searchBtn?.addEventListener('click', searchLocation);
    searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') searchLocation(); });
    locateBtn?.addEventListener('click', locateCurrent);

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
