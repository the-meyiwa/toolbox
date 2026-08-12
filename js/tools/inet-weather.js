export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Weather Dashboard</h2>
        <p class="tool-desc">Get the current weather for any city (via Open-Meteo free API).</p>
        <div class="tool-section">
          <input type="text" id="weather-input" class="tool-input" placeholder="e.g. London, Tokyo, New York">
          <button id="weather-btn" class="btn btn-primary" style="margin-top:12px;">Get Weather</button>
          <div id="weather-result" style="margin-top:16px; font-size:1.1rem;"></div>
        </div>
      </div>
    `;
    const btn = container.querySelector('#weather-btn');
    const input = container.querySelector('#weather-input');
    const res = container.querySelector('#weather-result');
    
    btn.addEventListener('click', async () => {
      const city = input.value.trim();
      if (!city) return;
      res.textContent = 'Fetching...';
      try {
        // Geocode first
        const geoReq = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoReq.json();
        if (!geoData.results || geoData.results.length === 0) {
          res.textContent = 'City not found.';
          return;
        }
        const { latitude, longitude, name, country } = geoData.results[0];
        
        // Fetch weather
        const wReq = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const wData = await wReq.json();
        const cw = wData.current_weather;
        
        res.innerHTML = `
          <strong>${name}, ${country}</strong><br>
          Temperature: ${cw.temperature}&deg;C<br>
          Wind Speed: ${cw.windspeed} km/h
        `;
      } catch (e) {
        res.textContent = 'Error fetching weather.';
      }
    });
  },
  destroy() {}
};