export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Subnet Calculator</h2>
        <p class="tool-desc">Calculate Network, Broadcast, and Host Range from an IP/CIDR completely offline.</p>
        <div class="tool-section">
          <div style="display:flex; gap:12px; margin-bottom:12px;">
            <input type="text" id="sn-ip" class="tool-input" placeholder="IP Address (e.g. 192.168.1.1)" style="flex:2;">
            <input type="number" id="sn-cidr" class="tool-input" placeholder="CIDR (e.g. 24)" min="0" max="32" style="flex:1;">
          </div>
          <button id="sn-btn" class="btn btn-primary" style="width:100%;">Calculate</button>
          <pre id="sn-res" class="tool-output" style="margin-top:16px; display:none;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#sn-btn');
    const res = container.querySelector('#sn-res');
    
    const ip2long = ip => ip.split('.').reduce((ipInt, octet) => (ipInt<<8) + parseInt(octet, 10), 0) >>> 0;
    const long2ip = long => [ (long>>>24)&255, (long>>>16)&255, (long>>>8)&255, long&255 ].join('.');
    
    btn.addEventListener('click', () => {
      const ip = container.querySelector('#sn-ip').value.trim();
      const cidr = parseInt(container.querySelector('#sn-cidr').value.trim());
      if(!ip || isNaN(cidr)) return;
      
      try {
        res.style.display = 'block';
        const maskLong = cidr === 0 ? 0 : ~((1 << (32 - cidr)) - 1) >>> 0;
        const ipLong = ip2long(ip);
        const networkLong = ipLong & maskLong;
        const broadcastLong = networkLong | (~maskLong >>> 0);
        
        const numHosts = (broadcastLong - networkLong - 1) >>> 0;
        
        // IPv4-mapped IPv6, absorbed from the old standalone converter
        // so that merge lost nothing.
        const hex = ip.split('.').map(p => parseInt(p, 10).toString(16).padStart(2, '0'));
        const mapped = `::ffff:${hex[0]}${hex[1]}:${hex[2]}${hex[3]}`;

        res.textContent = `IP Address:      ${ip}
Subnet Mask:     ${long2ip(maskLong)}
Network Address: ${long2ip(networkLong)}
Broadcast Addr:  ${long2ip(broadcastLong)}
First Host:      ${numHosts > 0 ? long2ip(networkLong + 1) : 'N/A'}
Last Host:       ${numHosts > 0 ? long2ip(broadcastLong - 1) : 'N/A'}
Total Hosts:     ${Math.max(0, numHosts)}
Wildcard Mask:   ${long2ip(~maskLong >>> 0)}
IPv4-mapped v6:  ${mapped}`;
      } catch(e) {
        res.textContent = 'Invalid IP format.';
      }
    });
  },
  destroy() {}
};