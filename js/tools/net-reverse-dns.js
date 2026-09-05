import { queryDns } from '../lib/dns-resolver.js';

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content" style="max-width:860px; margin:0 auto; padding:20px 16px;">
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.03); margin-bottom:20px;">
          <div style="margin-bottom:14px;">
            <h2 style="margin:0 0 4px; font-size:1.15rem; font-weight:700; color:var(--text);">Reverse DNS (PTR) Lookup</h2>
            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">
              Resolve an IPv4 or IPv6 address to its authoritative PTR domain name.
            </p>
          </div>

          <div style="display:flex; gap:10px; align-items:center;">
            <input type="text" id="rd-input" class="tool-input" placeholder="e.g. 8.8.8.8 or 1.1.1.1" value="8.8.8.8" style="flex:1; height:38px; padding:0 12px; font-size:0.88rem; border-radius:8px;">
            <button type="button" id="rd-btn" class="btn btn-primary" style="height:38px; padding:0 18px; font-size:0.84rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Lookup</span>
            </button>
          </div>

          <div style="display:flex; align-items:center; gap:8px; margin-top:12px; flex-wrap:wrap;">
            <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Presets:</span>
            <button type="button" class="btn-preset" data-ip="8.8.8.8" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">8.8.8.8 (Google)</button>
            <button type="button" class="btn-preset" data-ip="1.1.1.1" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">1.1.1.1 (Cloudflare)</button>
            <button type="button" class="btn-preset" data-ip="9.9.9.9" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">9.9.9.9 (Quad9)</button>
          </div>
        </div>

        <div id="rd-output-wrap" style="display:none;"></div>
      </div>
    `;

    const input = container.querySelector('#rd-input');
    const btn = container.querySelector('#rd-btn');
    const outputWrap = container.querySelector('#rd-output-wrap');

    container.querySelectorAll('.btn-preset').forEach(p => {
      p.addEventListener('click', () => {
        input.value = p.getAttribute('data-ip');
        performLookup();
      });
    });

    async function performLookup() {
      const ip = input.value.trim();
      if (!ip) return;

      outputWrap.style.display = 'block';
      outputWrap.innerHTML = `
        <div style="padding:20px; text-align:center; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; color:var(--text-muted); font-size:0.84rem;">
          Resolving PTR record for <strong>${escapeHtml(ip)}</strong>...
        </div>
      `;

      try {
        const result = await queryDns(ip, 'PTR');

        if (result.status === 'error') {
          outputWrap.innerHTML = `
            <div style="padding:16px 20px; background:var(--bg-card); border:1px solid #ef4444; border-radius:12px; color:#ef4444; font-size:0.84rem;">
              <div style="font-weight:700; margin-bottom:4px;">Reverse Lookup Failed</div>
              <div>${escapeHtml(result.message || 'Unable to resolve reverse PTR record.')}</div>
            </div>
          `;
          return;
        }

        const answers = result.answers || [];

        outputWrap.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
            <div style="padding:14px 18px; border-bottom:1px solid var(--border); background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-weight:700; font-size:0.92rem; color:var(--text);">${escapeHtml(result.domain)}</span>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">${escapeHtml(result.provider)}</span>
              </div>
              <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(result.queryName)}</span>
            </div>

            <div style="padding:18px;">
              ${answers.length > 0 ? answers.map(a => `
                <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:8px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                  <div>
                    <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:4px;">Host / Domain Name (PTR)</div>
                    <div style="font-size:1.05rem; font-weight:700; font-family:monospace; color:var(--text);">${escapeHtml(a.data)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">TTL: ${a.ttl ? a.ttl + 's' : '-'}</div>
                  </div>
                  <button type="button" class="btn-copy-host" data-host="${escapeHtml(a.data)}" style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:6px 12px; font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--text);">Copy Host</button>
                </div>
              `).join('') : `
                <div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:0.84rem;">
                  No PTR record published for ${escapeHtml(ip)}.
                </div>
              `}
            </div>
          </div>
        `;

        outputWrap.querySelectorAll('.btn-copy-host').forEach(b => {
          b.addEventListener('click', () => {
            navigator.clipboard.writeText(b.getAttribute('data-host'));
            b.textContent = 'Copied!';
            setTimeout(() => { b.textContent = 'Copy Host'; }, 1500);
          });
        });

      } catch (err) {
        outputWrap.innerHTML = `
          <div style="padding:16px 20px; background:var(--bg-card); border:1px solid #ef4444; border-radius:12px; color:#ef4444; font-size:0.84rem;">
            <div style="font-weight:700; margin-bottom:4px;">Error</div>
            <div>${escapeHtml(err.message)}</div>
          </div>
        `;
      }
    }

    btn.addEventListener('click', performLookup);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performLookup();
    });

    performLookup();
  },

  destroy() {}
};