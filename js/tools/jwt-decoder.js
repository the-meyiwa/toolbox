import { copyText } from '../utils.js';

function decodeJWT(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT: expected 3 parts, got ' + parts.length);
  // JWT segments are base64url, and the payload is UTF-8 JSON, so the bytes
  // have to be decoded properly rather than read as Latin-1.
  const decode = (str) => {
    let padded = str.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) padded += '=';
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  return { header: decode(parts[0]), payload: decode(parts[1]), signature: parts[2] };
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">JWT</label>
        <textarea class="tool-textarea" id="jwt-input" placeholder="Paste a JWT here…" rows="4" style="min-height:100px;"></textarea>
      </div>
      <div class="tool-split" style="margin-top:16px;">
        <div class="tool-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="tool-label" style="margin:0;">Header</label>
            <button class="copy-btn" id="jwt-ch">Copy</button>
          </div>
          <div class="tool-output" id="jwt-header" style="min-height:120px; font-size:0.82rem;"><span style="color:var(--g300);">—</span></div>
        </div>
        <div class="tool-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="tool-label" style="margin:0;">Payload</label>
            <button class="copy-btn" id="jwt-cp">Copy</button>
          </div>
          <div class="tool-output" id="jwt-payload" style="min-height:120px; font-size:0.82rem;"><span style="color:var(--g300);">—</span></div>
        </div>
      </div>
      <div id="jwt-info" style="margin-top:12px; font-size:0.78rem; color:var(--g500);"></div>
    `;

    const input = container.querySelector('#jwt-input');
    const headerEl = container.querySelector('#jwt-header');
    const payloadEl = container.querySelector('#jwt-payload');
    const infoEl = container.querySelector('#jwt-info');

    function decode() {
      const token = input.value.trim();
      if (!token) { headerEl.innerHTML = payloadEl.innerHTML = '<span style="color:var(--g300);">—</span>'; infoEl.textContent = ''; return; }
      try {
        const d = decodeJWT(token);
        headerEl.textContent = JSON.stringify(d.header, null, 2);
        payloadEl.textContent = JSON.stringify(d.payload, null, 2);
        let info = '✓ Valid JWT';
        if (d.payload.exp) { const exp = new Date(d.payload.exp * 1000); info += ' · ' + (exp < new Date() ? 'Expired' : 'Expires') + ': ' + exp.toLocaleString(); }
        if (d.payload.iat) { info += ' · Issued: ' + new Date(d.payload.iat * 1000).toLocaleString(); }
        infoEl.textContent = info; infoEl.style.color = 'var(--black)';
      } catch (e) {
        headerEl.innerHTML = payloadEl.innerHTML = '<span style="color:var(--g300);">—</span>';
        infoEl.textContent = '✗ ' + e.message; infoEl.style.color = 'var(--g600)';
      }
    }

    input.addEventListener('input', decode);
    container.querySelector('#jwt-ch').addEventListener('click', (e) => { const t = headerEl.textContent; if (t && t !== '—') copyText(t, e.currentTarget); });
    container.querySelector('#jwt-cp').addEventListener('click', (e) => { const t = payloadEl.textContent; if (t && t !== '—') copyText(t, e.currentTarget); });
    input.focus();
  },
  destroy() {}
};
