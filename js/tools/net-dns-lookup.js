import { queryDns, DNS_TYPE_MAP } from '../lib/dns-resolver.js';

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content" style="max-width:900px; margin:0 auto; padding:20px 16px;">
        
        <!-- HEADER & FORM -->
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.03); margin-bottom:20px;">
          <div style="margin-bottom:14px;">
            <h2 style="margin:0 0 4px; font-size:1.15rem; font-weight:700; color:var(--text);">DNS Record Lookup</h2>
            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">
              Query live DNS records across authoritative root nameservers using resilient DNS-over-HTTPS.
            </p>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            <div style="flex:1; min-width:240px; position:relative;">
              <input type="text" id="dns-input" class="tool-input" placeholder="e.g. google.com or github.com" value="google.com" style="width:100%; height:38px; padding:0 12px; font-size:0.88rem; border-radius:8px;">
            </div>

            <div style="min-width:130px;">
              <select id="dns-type-select" class="tool-select" style="width:100%; height:38px; padding:0 10px; font-size:0.84rem; border-radius:8px;">
                <option value="A" selected>A (IPv4)</option>
                <option value="AAAA">AAAA (IPv6)</option>
                <option value="MX">MX (Mail)</option>
                <option value="TXT">TXT (Text/SPF)</option>
                <option value="CNAME">CNAME (Alias)</option>
                <option value="NS">NS (Nameserver)</option>
                <option value="SOA">SOA (Authority)</option>
                <option value="CAA">CAA (Certificate)</option>
                <option value="ANY">ANY (All Types)</option>
              </select>
            </div>

            <button type="button" id="dns-btn" class="btn btn-primary" style="height:38px; padding:0 18px; font-size:0.84rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Lookup</span>
            </button>
          </div>

          <!-- Quick Presets -->
          <div style="display:flex; align-items:center; gap:8px; margin-top:12px; flex-wrap:wrap;">
            <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Presets:</span>
            <button type="button" class="btn-preset" data-domain="google.com" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">google.com</button>
            <button type="button" class="btn-preset" data-domain="github.com" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">github.com</button>
            <button type="button" class="btn-preset" data-domain="cloudflare.com" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">cloudflare.com</button>
            <button type="button" class="btn-preset" data-domain="wikipedia.org" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:0.72rem; color:var(--text); cursor:pointer;">wikipedia.org</button>
          </div>
        </div>

        <!-- RESULTS CONTAINER -->
        <div id="dns-output-wrap" style="display:none;"></div>
      </div>
    `;

    const input = container.querySelector('#dns-input');
    const typeSelect = container.querySelector('#dns-type-select');
    const btn = container.querySelector('#dns-btn');
    const outputWrap = container.querySelector('#dns-output-wrap');

    // Preset buttons
    container.querySelectorAll('.btn-preset').forEach(p => {
      p.addEventListener('click', () => {
        input.value = p.getAttribute('data-domain');
        performLookup();
      });
    });

    async function performLookup() {
      const rawDomain = input.value.trim();
      const type = typeSelect.value;
      if (!rawDomain) return;

      outputWrap.style.display = 'block';
      outputWrap.innerHTML = `
        <div style="padding:24px; text-align:center; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; color:var(--text-muted); font-size:0.85rem;">
          Querying DNS records for <strong>${escapeHtml(rawDomain)}</strong> (${escapeHtml(type)})...
        </div>
      `;

      try {
        const result = await queryDns(rawDomain, type);

        if (result.status === 'error') {
          outputWrap.innerHTML = `
            <div style="padding:16px 20px; background:var(--bg-card); border:1px solid #ef4444; border-radius:12px; color:#ef4444; font-size:0.84rem;">
              <div style="font-weight:700; margin-bottom:4px;">Lookup Failed</div>
              <div>${escapeHtml(result.message || 'Unable to resolve DNS records.')}</div>
            </div>
          `;
          return;
        }

        const answers = result.answers || [];

        outputWrap.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
            <!-- Status Header -->
            <div style="padding:14px 18px; border-bottom:1px solid var(--border); background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <span style="font-weight:700; font-size:0.92rem; color:var(--text);">${escapeHtml(result.domain)}</span>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">${escapeHtml(result.provider)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.75rem; background:var(--bg-card); border:1px solid var(--border); padding:2px 8px; border-radius:999px; color:var(--text); font-weight:600;">
                  ${answers.length} Record(s)
                </span>
                <button type="button" id="btn-copy-dns" class="btn btn-secondary btn-sm" style="padding:3px 10px; font-size:0.75rem;">Copy All</button>
              </div>
            </div>

            <!-- Table of Records -->
            ${answers.length > 0 ? `
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:left;">
                  <thead>
                    <tr style="background:var(--bg-subtle); border-bottom:1px solid var(--border); color:var(--text-muted); font-size:0.74rem; text-transform:uppercase; letter-spacing:0.04em;">
                      <th style="padding:10px 16px;">Type</th>
                      <th style="padding:10px 16px;">Name</th>
                      <th style="padding:10px 16px;">TTL</th>
                      <th style="padding:10px 16px;">Data / Value</th>
                      <th style="padding:10px 16px; text-align:right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${answers.map(a => `
                      <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:10px 16px; font-weight:700; color:var(--text);">
                          <span style="padding:2px 7px; border-radius:4px; background:var(--bg-subtle); border:1px solid var(--border); font-size:0.72rem;">${escapeHtml(a.type)}</span>
                        </td>
                        <td style="padding:10px 16px; color:var(--text); font-family:monospace; word-break:break-all;">${escapeHtml(a.name)}</td>
                        <td style="padding:10px 16px; color:var(--text-muted); font-family:monospace;">${a.ttl ? a.ttl + 's' : '-'}</td>
                        <td style="padding:10px 16px; color:var(--text); font-family:monospace; word-break:break-all;">${escapeHtml(a.data)}</td>
                        <td style="padding:10px 16px; text-align:right;">
                          <button type="button" class="btn-copy-val" data-val="${escapeHtml(a.data)}" style="background:none; border:1px solid var(--border); border-radius:5px; padding:3px 8px; font-size:0.72rem; cursor:pointer; color:var(--text);">Copy</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="padding:32px 20px; text-align:center; color:var(--text-secondary); font-size:0.85rem;">
                No ${escapeHtml(type)} records found for <strong>${escapeHtml(result.domain)}</strong>.
              </div>
            `}
          </div>
        `;

        // Wire Copy All
        outputWrap.querySelector('#btn-copy-dns')?.addEventListener('click', (e) => {
          const text = answers.map(a => `${a.type}\t${a.name}\t${a.ttl}s\t${a.data}`).join('\n');
          navigator.clipboard.writeText(text);
          e.target.textContent = 'Copied!';
          setTimeout(() => { e.target.textContent = 'Copy All'; }, 1800);
        });

        // Wire Copy Value buttons
        outputWrap.querySelectorAll('.btn-copy-val').forEach(b => {
          b.addEventListener('click', () => {
            const val = b.getAttribute('data-val');
            navigator.clipboard.writeText(val);
            b.textContent = 'Copied!';
            setTimeout(() => { b.textContent = 'Copy'; }, 1500);
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

    // Run default lookup on initial render
    performLookup();
  },

  destroy() {}
};