export default {
  render(container) {
    const statuses = {
      200: 'OK', 201: 'Created', 204: 'No Content',
      301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 429: 'Too Many Requests',
      500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout'
    };
    
    let html = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">HTTP Status Codes</h2>
        <p class="tool-desc">Quick reference for common HTTP status codes.</p>
        <div class="tool-section" style="display:grid; gap:8px;">
    `;
    for(const [code, desc] of Object.entries(statuses)) {
      let color = code.startsWith('2') ? 'var(--green)' : code.startsWith('3') ? 'var(--blue)' : code.startsWith('4') ? 'var(--orange)' : 'var(--red)';
      html += `<div style="display:flex; justify-content:space-between; padding:12px; background:var(--g50); border-radius:6px; border-left:4px solid ${color};">
        <span style="font-weight:700; font-family:var(--mono);">${code}</span>
        <span style="color:var(--g700);">${desc}</span>
      </div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
  },
  destroy() {}
};