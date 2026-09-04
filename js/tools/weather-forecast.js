export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        
        <div class="tool-section">
          <label class="tool-label">Where?</label>
          <div style="display:flex; gap:8px;">
            <input type="text" class="tool-input" id="weather-city" placeholder="e.g. Tokyo, Paris, New York" style="flex:1;">
            <button class="btn btn-primary" id="weather-search">Search</button>
          </div>
          
          <div id="weather-results" style="margin-top:12px; display:flex; flex-direction:column; gap:4px;"></div>
        </div>

        <div id="weather-display" style="display:none; margin-top:24px;">
          <h3 id="weather-location-name" style="font-family:var(--pixel); font-size:1.5rem; margin-bottom:16px;"></h3>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
            <div class="tool-stat" style="background:var(--black); color:var(--white);">
              <div class="tool-stat-value" id="current-temp" style="font-family:var(--pixel); font-size:2.5rem;">--°C</div>
              <div class="tool-stat-label" id="current-desc" style="color:var(--g400);">Loading…</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="current-wind" style="font-family:var(--pixel); font-size:1.5rem;">-- km/h</div>
              <div class="tool-stat-label">Wind speed</div>
            </div>
          </div>
          
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">The next three days</h4>
          <div id="forecast-container" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;"></div>

          <p class="biz-hint" style="margin-top:16px;">Forecast and place names from
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.</p>
        </div>
      </div>
    `;

    const cityInput = container.querySelector('#weather-city');
    const searchBtn = container.querySelector('#weather-search');
    const resultsDiv = container.querySelector('#weather-results');
    const displayDiv = container.querySelector('#weather-display');
    const locName = container.querySelector('#weather-location-name');
    const forecastContainer = container.querySelector('#forecast-container');

    /* The full WMO interpretation table the forecast API returns. Showers and
       freezing rain were missing before, so the commonest British weather of
       all came back as "Unknown". */
    const weatherCodes = {
      0: 'Clear sky',
      1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Freezing fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      66: 'Light freezing rain', 67: 'Heavy freezing rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
      85: 'Slight snow showers', 86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
    };

    const getDesc = (code) => weatherCodes[code] ?? 'Not reported';

    async function searchCity() {
      const q = cityInput.value.trim();
      if (!q) return;
      resultsDiv.innerHTML = '<span style="color:var(--g500);">Searching…</span>';
      displayDiv.style.display = 'none';

      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
        const data = await res.json();
        
        resultsDiv.innerHTML = '';
        if (!data.results || data.results.length === 0) {
          resultsDiv.innerHTML = '<span style="color:var(--g500);">No locations found.</span>';
          return;
        }

        data.results.forEach(loc => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-secondary btn-sm';
          btn.style.textAlign = 'left';
          btn.textContent = `${loc.name}, ${loc.admin1 ? loc.admin1 + ', ' : ''}${loc.country}`;
          btn.onclick = () => loadWeather(loc);
          resultsDiv.appendChild(btn);
        });
      } catch (e) {
        resultsDiv.innerHTML = '<span style="color:var(--g500);">That search could not be completed. Check your connection and try again.</span>';
      }
    }

    async function loadWeather(loc) {
      resultsDiv.innerHTML = '';
      cityInput.value = '';
      displayDiv.style.display = 'block';
      locName.textContent = `${loc.name}, ${loc.country}`;
      
      container.querySelector('#current-temp').textContent = '--°C';
      container.querySelector('#current-desc').textContent = 'Loading…';
      forecastContainer.innerHTML = '';

      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
        const data = await res.json();

        const current = data.current_weather;
        container.querySelector('#current-temp').textContent = `${current.temperature}°C`;
        container.querySelector('#current-desc').textContent = getDesc(current.weathercode);
        container.querySelector('#current-wind').textContent = `${current.windspeed} km/h`;

        const daily = data.daily;
        let html = '';
        for (let i = 1; i <= 3; i++) { // Next 3 days
          const date = new Date(daily.time[i]);
          const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
          html += `
            <div style="background:var(--g50); padding:12px; border-radius:8px; text-align:center;">
              <div style="font-family:var(--pixel); font-size:1.1rem; margin-bottom:8px;">${dayName}</div>
              <div style="font-size:0.85rem; color:var(--g600); height:40px; display:flex; align-items:center; justify-content:center;">
                ${getDesc(daily.weathercode[i])}
              </div>
              <div style="margin-top:8px;">
                <span style="font-weight:600;">${daily.temperature_2m_max[i]}°</span>
                <span style="color:var(--g400); font-size:0.9rem; margin-left:4px;">${daily.temperature_2m_min[i]}°</span>
              </div>
            </div>
          `;
        }
        forecastContainer.innerHTML = html;

      } catch (e) {
        container.querySelector('#current-desc').textContent = 'Forecast unavailable';
      }
    }

    searchBtn.addEventListener('click', searchCity);
    cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchCity(); });
  },
  destroy() {}
};
